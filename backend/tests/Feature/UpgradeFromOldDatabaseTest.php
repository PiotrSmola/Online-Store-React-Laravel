<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Runs the real migrations over rows written by the build the owner runs today. The suite's
 * sqlite database is in memory, so nothing here leaks into the RefreshDatabase tests.
 */
class UpgradeFromOldDatabaseTest extends TestCase
{
    private const FIRST_NEW_MIGRATION = '2026_11_06_100000_add_catalog_columns_to_products_table';

    private int $customerId;

    private int $productId;

    protected function setUp(): void
    {
        parent::setUp();

        Artisan::call('migrate:fresh');
        Artisan::call('migrate:rollback', [
            '--step' => DB::table('migrations')->where('migration', '>=', self::FIRST_NEW_MIGRATION)->count(),
        ]);

        $this->customerId = DB::table('customers')->insertGetId([
            'email' => 'stary@example.com',
            'password' => 'x',
            'first_name' => 'Jan',
            'last_name' => 'Stary',
            'address' => 'Stara 1',
            'city' => 'Kraków',
            'postal_code' => '30-001',
        ]);

        $this->productId = DB::table('products')->insertGetId([
            'nazwa' => 'Stara kurtka',
            'kategoria' => 'Kurtki',
            'cena' => 100,
            'opis' => 'Opis',
            'ocena' => 4.5,
            'rozmiar' => json_encode(['M']),
            'kolor' => json_encode(['Czarny']),
        ]);
    }

    private function oldOrder(array $overrides = []): int
    {
        $id = DB::table('orders')->insertGetId(array_merge([
            'order_number' => 'ORD-' . uniqid(),
            'customer_id' => $this->customerId,
            'total_amount' => 115.99,
            'status' => 'pending',
            'payment_method' => 'card',
            'delivery_method' => 'courier',
            'delivery_price' => 15.99,
            'billing_address' => '{}',
            'shipping_address' => '{}',
            'payment_details' => json_encode(['method' => 'card', 'card_last_four' => '4242', 'card_name' => 'Jan Stary']),
            'order_date' => '2025-06-10 12:00:00',
        ], $overrides));

        DB::table('order_items')->insert([
            'order_id' => $id,
            'product_id' => $this->productId,
            'quantity' => 2,
            'price' => 100,
            'selected_size' => 'M',
            'selected_color' => 'Czarny',
        ]);

        return $id;
    }

    public function test_old_order_items_get_the_product_name(): void
    {
        $id = $this->oldOrder();

        Artisan::call('migrate');

        $this->assertSame('Stara kurtka', DB::table('order_items')->where('order_id', $id)->value('product_name'));
    }

    public function test_old_card_orders_with_last_four_digits_count_as_paid(): void
    {
        $id = $this->oldOrder();

        Artisan::call('migrate');

        $order = Order::findOrFail($id);
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame('2025-06-10 12:00:00', $order->paid_at->toDateTimeString());
    }

    public function test_a_cancelled_old_card_order_counts_as_refunded(): void
    {
        $id = $this->oldOrder(['status' => 'cancelled']);

        Artisan::call('migrate');

        $this->assertSame('refunded', Order::findOrFail($id)->payment_status);
    }

    public function test_old_transfer_orders_stay_unpaid_for_an_admin_to_confirm(): void
    {
        $id = $this->oldOrder([
            'payment_method' => 'transfer',
            'payment_details' => json_encode(['method' => 'transfer']),
        ]);

        Artisan::call('migrate');

        $order = Order::findOrFail($id);
        $this->assertSame('unpaid', $order->payment_status);

        $this->assertSame('paid', app(OrderService::class)->markPaid($order)->payment_status);
    }

    public function test_every_old_order_gets_one_status_event(): void
    {
        $paid = $this->oldOrder(['status' => 'shipped']);
        $transfer = $this->oldOrder(['payment_method' => 'transfer', 'payment_details' => '{}']);

        Artisan::call('migrate');

        $this->assertSame(1, DB::table('order_status_events')->where('order_id', $paid)->count());
        $this->assertSame(1, DB::table('order_status_events')->where('order_id', $transfer)->count());

        $event = Order::findOrFail($paid)->statusEvents()->sole();
        $this->assertSame('shipped', $event->status);
        $this->assertSame('Zamówienie złożone przed aktualizacją sklepu', $event->note);
        $this->assertSame('2025-06-10 12:00:00', $event->created_at->toDateTimeString());
    }

    public function test_paying_twice_stays_impossible_for_old_paid_orders(): void
    {
        $id = $this->oldOrder();
        Artisan::call('migrate');

        $this->actingAs(Customer::findOrFail($this->customerId), 'sanctum')
            ->postJson("/api/orders/{$id}/pay", ['card_last_four' => '4242'])
            ->assertStatus(409);
    }

    public function test_an_old_card_order_without_card_details_cannot_be_paid_online(): void
    {
        $id = $this->oldOrder(['payment_details' => json_encode(['method' => 'card'])]);
        Artisan::call('migrate');
        $this->assertSame('unpaid', Order::findOrFail($id)->payment_status);

        $this->actingAs(Customer::findOrFail($this->customerId), 'sanctum')
            ->postJson("/api/orders/{$id}/pay", ['card_last_four' => '4242'])
            ->assertStatus(409);

        $this->assertSame('unpaid', Order::findOrFail($id)->payment_status);
    }

    public function test_cancelling_an_old_order_adds_no_stock_it_never_took(): void
    {
        $id = $this->oldOrder();
        Artisan::call('migrate');
        $stock = fn () => (int) DB::table('product_variants')->where('product_id', $this->productId)->value('stock');
        $this->assertSame(10, $stock());

        app(OrderService::class)->changeStatus(Order::findOrFail($id), 'cancelled');

        $this->assertSame(10, $stock());
        $this->assertSame('cancelled', Order::findOrFail($id)->status);
    }

    public function test_orders_placed_after_the_upgrade_still_return_their_stock(): void
    {
        Artisan::call('migrate');
        $service = app(OrderService::class);
        $order = $service->place(Customer::findOrFail($this->customerId), [
            'items' => [['product_id' => $this->productId, 'quantity' => 2, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
        ]);
        $stock = fn () => (int) DB::table('product_variants')->where('product_id', $this->productId)->value('stock');
        $this->assertSame(8, $stock());

        $service->changeStatus($order, 'cancelled');

        $this->assertSame(10, $stock());
    }

    public function test_orders_that_already_have_events_keep_their_stock_tracking(): void
    {
        Artisan::call('migrate');
        $id = $this->oldOrder();
        Artisan::call('migrate:rollback', [
            '--step' => DB::table('migrations')->where('migration', '>=', '2026_11_06_101400_settle_orders_from_before_stock_tracking')->count(),
        ]);
        DB::table('order_status_events')->insert(['order_id' => $id, 'status' => 'pending']);

        Artisan::call('migrate');

        $this->assertTrue(Order::findOrFail($id)->stock_deducted);
        $this->assertSame('unpaid', Order::findOrFail($id)->payment_status);
        $this->assertSame(1, DB::table('order_status_events')->where('order_id', $id)->count());
    }

    public function test_the_stock_flag_stays_out_of_the_api(): void
    {
        $id = $this->oldOrder();
        Artisan::call('migrate');

        $this->assertArrayNotHasKey('stock_deducted', Order::findOrFail($id)->toArray());
    }

    public function test_the_container_start_fills_the_old_shop_once(): void
    {
        $this->oldOrder();
        Artisan::call('migrate');

        Artisan::call('shop:seed', ['--if-empty' => true, '--local' => true]);
        Artisan::call('shop:seed', ['--if-empty' => true, '--local' => true]);

        $this->assertSame(1, DB::table('products')->count());
        $this->assertSame(2, DB::table('coupons')->count());
        $this->assertSame(7, DB::table('customers')->count());
        $this->assertGreaterThan(0, DB::table('reviews')->where('product_id', $this->productId)->count());
    }

    public function test_the_migrations_roll_back_cleanly(): void
    {
        $this->oldOrder();
        Artisan::call('migrate');

        Artisan::call('migrate:rollback', [
            '--step' => DB::table('migrations')->where('migration', '>=', self::FIRST_NEW_MIGRATION)->count(),
        ]);

        $this->assertFalse(Schema::hasColumn('orders', 'stock_deducted'));
        $this->assertFalse(Schema::hasTable('product_variants'));
        $this->assertSame(1, DB::table('orders')->count());
    }
}
