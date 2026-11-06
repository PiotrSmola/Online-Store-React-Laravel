<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
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
}
