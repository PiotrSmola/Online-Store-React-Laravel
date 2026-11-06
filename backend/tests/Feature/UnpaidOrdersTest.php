<?php

namespace Tests\Feature;

use App\Mail\OrderStatusChanged;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderService;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class UnpaidOrdersTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const NOTE = 'Anulowane automatycznie: brak płatności w terminie';

    private function place(string $method = 'transfer', ?Product $product = null, int $quantity = 1, ?Customer $customer = null): Order
    {
        return app(OrderService::class)->place($customer ?? $this->createCustomer(['email' => uniqid() . '@example.com']), [
            'items' => [['product_id' => ($product ?? $this->createProduct())->id, 'quantity' => $quantity, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => $method,
            'delivery_method' => $method === 'cash' ? 'store_pickup' : 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => $method],
        ]);
    }

    private function expire(): void
    {
        $this->artisan('orders:expire-unpaid')->assertSuccessful();
    }

    // Expiry

    public static function expiringMethods(): array
    {
        return [['card'], ['transfer']];
    }

    #[DataProvider('expiringMethods')]
    public function test_an_unpaid_order_past_the_limit_is_cancelled_and_frees_its_stock(string $method): void
    {
        $product = $this->createProduct([], 5);
        $order = $this->place($method, $product, 5);
        $this->assertSame(0, $this->variantOf($product)->stock);

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(5, $this->variantOf($product)->stock);
        $this->assertSame(self::NOTE, $order->statusEvents()->where('status', 'cancelled')->sole()->note);
    }

    public function test_an_order_inside_the_limit_stays(): void
    {
        $order = $this->place();

        $this->travel(47)->hours();
        $this->expire();

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_the_limit_comes_from_config(): void
    {
        config(['shop.unpaid_order_hours' => 2]);
        $order = $this->place();

        $this->travel(3)->hours();
        $this->expire();

        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_a_declined_card_order_expires_too(): void
    {
        $order = $this->place('card');
        DB::table('orders')->where('id', $order->id)->update(['payment_status' => 'failed']);

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_cash_for_store_pickup_stays(): void
    {
        $order = $this->place('cash');

        $this->travel(30)->days();
        $this->expire();

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_a_paid_order_stays(): void
    {
        $order = $this->place('card');
        app(OrderService::class)->pay($order, '4242');

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('processing', $order->fresh()->status);
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_an_unpaid_order_an_admin_moved_on_stays(): void
    {
        $order = $this->place();
        app(OrderService::class)->changeStatus($order, 'processing');

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_orders_from_before_stock_tracking_are_left_alone(): void
    {
        $order = $this->place();
        DB::table('orders')->where('id', $order->id)->update(['stock_deducted' => false]);

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_running_twice_returns_the_stock_once(): void
    {
        $product = $this->createProduct([], 5);
        $this->place('transfer', $product, 2);

        $this->travel(49)->hours();
        $this->expire();
        $this->expire();

        $this->assertSame(5, $this->variantOf($product)->stock);
    }

    public function test_the_coupon_use_comes_back(): void
    {
        $coupon = Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);
        $order = app(OrderService::class)->place($this->createCustomer(), [
            'items' => [['product_id' => $this->createProduct()->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
            'coupon_code' => 'WITAJ10',
        ]);
        $this->assertSame(1, $coupon->fresh()->used_count);

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(0, $coupon->fresh()->used_count);
    }

    public function test_the_customer_is_told_why(): void
    {
        $order = $this->place();
        Mail::fake();

        $this->travel(49)->hours();
        $this->expire();

        Mail::assertQueued(OrderStatusChanged::class, fn (OrderStatusChanged $mail) => $mail->status === 'cancelled'
            && $mail->note === self::NOTE
            && $mail->order->is($order));
    }

    public function test_a_payment_arriving_between_the_query_and_the_lock_wins(): void
    {
        $service = app(OrderService::class);
        $stale = $this->place('card');
        $service->pay(Order::findOrFail($stale->id), '4242');

        try {
            $service->changeStatus($stale, 'cancelled', self::NOTE, requiredStatus: 'pending');
            $this->fail('A paid order must not be cancelled by the expiry.');
        } catch (\Illuminate\Validation\ValidationException) {
            $this->assertSame('paid', $stale->fresh()->payment_status);
            $this->assertSame('processing', $stale->fresh()->status);
        }
    }

    public function test_one_failure_does_not_stop_the_others(): void
    {
        $first = $this->place();
        $second = $this->place();
        Order::saving(function (Order $order) use ($first) {
            if ($order->id === $first->id) {
                throw new \RuntimeException('boom');
            }
        });

        $this->travel(49)->hours();
        $this->expire();

        $this->assertSame('pending', Order::find($first->id)->status);
        $this->assertSame('cancelled', Order::find($second->id)->status);
    }

    public function test_expiring_is_scheduled(): void
    {
        $commands = collect(app(Schedule::class)->events())->map(fn ($event) => $event->command)->implode(' ');

        $this->assertStringContainsString('orders:expire-unpaid', $commands);
    }


    // Limits on open orders

    private function guestOrder(string $email, ?Product $product = null, array $overrides = []): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($product ?? $this->createProduct(), ['email' => $email] + $overrides));
    }

    public function test_one_address_cannot_hold_more_than_the_limit_with_new_emails(): void
    {
        config(['shop.open_orders.per_ip' => 3]);
        $product = $this->createProduct();

        for ($i = 0; $i < 3; $i++) {
            $this->guestOrder("gosc{$i}@example.com", $product)->assertOk();
        }

        $response = $this->guestOrder('gosc9@example.com', $product)->assertStatus(429);

        $this->assertStringContainsString('nieopłaconych zamówień', $response->json('message'));
        $this->assertDatabaseCount('orders', 3);
        $this->assertDatabaseMissing('customers', ['email' => 'gosc9@example.com']);
        $this->assertSame(97, $this->variantOf($product)->stock);
    }

    public function test_another_address_is_not_affected(): void
    {
        config(['shop.open_orders.per_ip' => 1]);
        $product = $this->createProduct();
        $this->guestOrder('a@example.com', $product)->assertOk();

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

        $this->guestOrder('b@example.com', $product)->assertOk();
    }

    public function test_one_customer_cannot_hold_more_than_the_limit_from_any_address(): void
    {
        config(['shop.open_orders.per_customer' => 2]);
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $token = $customer->createToken('customer-token')->plainTextToken;

        for ($i = 0; $i < 2; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"]);
            $this->withToken($token)->postJson('/api/orders', $this->orderPayload($product))->assertOk();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50']);
        $this->withToken($token)->postJson('/api/orders', $this->orderPayload($product))->assertStatus(429);
    }

    public function test_the_per_customer_limit_also_binds_a_guest_with_the_right_password(): void
    {
        config(['shop.open_orders.per_customer' => 1]);
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $credentials = ['password' => $this->customerPassword];

        $this->guestOrder($customer->email, $product, $credentials)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->guestOrder($customer->email, $product, $credentials)->assertStatus(429)->assertJsonMissingPath('token');
    }

    public function test_paying_or_cancelling_frees_a_place(): void
    {
        config(['shop.open_orders.per_ip' => 1]);
        $product = $this->createProduct();

        $first = $this->guestOrder('a@example.com', $product)->assertOk();
        $this->guestOrder('b@example.com', $product)->assertStatus(429);

        $this->app['auth']->forgetGuards();
        $this->withToken($first->json('token'))->postJson('/api/orders/' . $first->json('order.id') . '/pay', ['card_last_four' => '4242'])->assertOk();
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        $second = $this->guestOrder('b@example.com', $product)->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($second->json('token'))->postJson('/api/orders/' . $second->json('order.id') . '/cancel')->assertOk();
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        $this->guestOrder('c@example.com', $product)->assertOk();
    }

    public function test_a_declined_card_still_counts_as_open(): void
    {
        config(['shop.open_orders.per_ip' => 1]);
        $product = $this->createProduct();
        $this->guestOrder('a@example.com', $product)->assertOk();
        DB::table('orders')->update(['payment_status' => 'failed']);

        $this->guestOrder('b@example.com', $product)->assertStatus(429);
    }

    public function test_cash_orders_count_because_they_never_expire(): void
    {
        config(['shop.open_orders.per_ip' => 1]);
        $product = $this->createProduct();
        $cash = ['payment_method' => 'cash', 'delivery_method' => 'store_pickup'];

        $this->guestOrder('a@example.com', $product, $cash)->assertOk();

        $this->guestOrder('b@example.com', $product, $cash)->assertStatus(429);
    }

    public function test_an_expired_order_frees_its_place(): void
    {
        config(['shop.open_orders.per_ip' => 1]);
        $product = $this->createProduct();
        $this->guestOrder('a@example.com', $product)->assertOk();

        $this->travel(49)->hours();
        $this->expire();

        $this->guestOrder('b@example.com', $product)->assertOk();
    }

    public function test_the_address_is_stored_only_as_a_hash_that_stays_out_of_the_api(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.77']);

        $order = $this->guestOrder('a@example.com')->assertOk()->json('order');

        $stored = DB::table('orders')->value('client_ip_hash');
        $this->assertSame(64, strlen($stored));
        $this->assertStringNotContainsString('203.0.113.77', json_encode(DB::table('orders')->first()));
        $this->assertArrayNotHasKey('client_ip_hash', $order);
    }

    public function test_a_placement_stuck_behind_a_held_lock_gets_a_polish_429(): void
    {
        $hash = hash_hmac('sha256', '127.0.0.1', (string) config('app.key'));
        $held = Cache::lock("order-placement:{$hash}", 30);
        $this->assertTrue($held->get());

        $this->guestOrder('a@example.com')->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);

        $held->release();
        $this->guestOrder('a@example.com')->assertOk();
    }

    public function test_a_refused_order_leaves_the_lock_free(): void
    {
        config(['shop.open_orders.per_ip' => 0]);

        $this->guestOrder('a@example.com')->assertStatus(429);

        config(['shop.open_orders.per_ip' => 5]);
        $this->guestOrder('a@example.com')->assertOk();
    }
}
