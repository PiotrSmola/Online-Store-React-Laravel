<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Services\CartPricing;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class CouponTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function coupon(array $overrides = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => 'WITAJ10',
            'type' => 'percent',
            'value' => 10,
        ], $overrides));
    }

    private function quote(Product $product, string $coupon, array $extra = []): TestResponse
    {
        return $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => $extra['quantity'] ?? 1, 'size' => 'M', 'color' => 'Czarny']],
            'coupon' => $coupon,
            'delivery_method' => $extra['delivery_method'] ?? 'courier',
        ]);
    }

    private function checkout(Product $product, string $coupon): array
    {
        return [
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
            'coupon_code' => $coupon,
        ];
    }

    private function order(Product $product, string $coupon, array $overrides = []): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($product, ['coupon_code' => $coupon] + $overrides));
    }

    public function test_percent_coupon_lowers_the_quote(): void
    {
        $this->coupon();
        $product = $this->createProduct(['cena' => 200]);

        $this->quote($product, 'WITAJ10')->assertOk()
            ->assertJsonPath('subtotal', 200)
            ->assertJsonPath('discount', 20)
            ->assertJsonPath('coupon', ['code' => 'WITAJ10', 'label' => 'Rabat 10%'])
            ->assertJsonPath('coupon_error', null)
            ->assertJsonPath('total', 195.99);
    }

    public function test_fixed_coupon_lowers_the_quote(): void
    {
        $this->coupon(['code' => 'MINUS20', 'type' => 'fixed', 'value' => 20, 'min_order' => 150]);

        $this->quote($this->createProduct(['cena' => 200]), 'MINUS20')
            ->assertJsonPath('discount', 20)
            ->assertJsonPath('coupon.label', 'Rabat 20,00 zł');
    }

    public function test_code_is_matched_regardless_of_case_and_spaces(): void
    {
        $this->coupon();

        $this->quote($this->createProduct(), '  witaj10 ')->assertJsonPath('coupon.code', 'WITAJ10');
    }

    public function test_percent_rounds_to_the_grosz(): void
    {
        $this->coupon(['value' => 15]);

        // 15% of 33.33 is 4.9995.
        $this->quote($this->createProduct(['cena' => 33.33]), 'WITAJ10')->assertJsonPath('discount', 5);
    }

    public function test_fixed_discount_stops_at_the_subtotal(): void
    {
        $this->coupon(['type' => 'fixed', 'value' => 500]);

        $this->quote($this->createProduct(['cena' => 50]), 'WITAJ10')
            ->assertJsonPath('discount', 50)
            ->assertJsonPath('total', 15.99);
    }

    public function test_free_delivery_is_checked_after_the_discount(): void
    {
        $this->coupon();

        // 320 clears the threshold, 288 after 10% does not.
        $this->quote($this->createProduct(['cena' => 320]), 'WITAJ10')
            ->assertJsonPath('discount', 32)
            ->assertJsonPath('delivery_price', 15.99)
            ->assertJsonPath('free_delivery_missing', 12)
            ->assertJsonPath('total', 303.99);
    }

    public static function rejectedCoupons(): array
    {
        return [
            'unknown' => [[], 'INNY', 'Nieprawidłowy kod rabatowy'],
            'disabled' => [['is_active' => false], 'WITAJ10', 'Nieprawidłowy kod rabatowy'],
            'expired' => [['expires_at' => '2020-01-01 00:00:00'], 'WITAJ10', 'Ten kod rabatowy wygasł'],
            'used up' => [['max_uses' => 0], 'WITAJ10', 'Ten kod rabatowy został już wykorzystany'],
            'below the minimum' => [['min_order' => 150], 'WITAJ10', 'Minimalna wartość zamówienia dla tego kodu to 150,00 zł'],
        ];
    }

    #[DataProvider('rejectedCoupons')]
    public function test_rejected_coupon_is_reported_and_the_quote_still_works(array $attributes, string $code, string $message): void
    {
        $this->coupon($attributes);

        $this->quote($this->createProduct(), $code)->assertOk()
            ->assertJsonPath('coupon', null)
            ->assertJsonPath('coupon_error', $message)
            ->assertJsonPath('discount', 0)
            ->assertJsonPath('subtotal', 100.5);
    }

    #[DataProvider('rejectedCoupons')]
    public function test_rejected_coupon_refuses_the_order_and_writes_nothing(array $attributes, string $code, string $message): void
    {
        $this->coupon($attributes);
        $product = $this->createProduct([], 5);

        $response = $this->order($product, $code)->assertStatus(422);

        $this->assertSame([$message], $response->json('errors.coupon_code'));
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $this->variantOf($product)->stock);
    }

    public function test_coupon_valid_until_a_later_moment_still_works(): void
    {
        $this->coupon(['expires_at' => now()->addDay()]);

        $this->quote($this->createProduct(), 'WITAJ10')->assertJsonPath('coupon_error', null);
    }

    public function test_order_records_the_discount_and_counts_the_use(): void
    {
        $coupon = $this->coupon();

        $this->order($this->createProduct(['cena' => 200]), 'witaj10')->assertOk();

        $order = Order::sole();
        $this->assertSame('WITAJ10', $order->coupon_code);
        $this->assertSame('200.00', $order->subtotal_amount);
        $this->assertSame('20.00', $order->discount_amount);
        $this->assertSame('195.99', $order->total_amount);
        $this->assertSame(1, $coupon->fresh()->used_count);
    }

    public function test_order_total_matches_the_quote(): void
    {
        $this->coupon(['code' => 'MINUS20', 'type' => 'fixed', 'value' => 20]);
        $product = $this->createProduct(['cena' => 123.45]);

        $quoted = $this->quote($product, 'MINUS20')->json('total');
        $this->order($product, 'MINUS20')->assertOk();

        $this->assertSame((string) number_format($quoted, 2, '.', ''), Order::sole()->total_amount);
    }

    public function test_order_without_a_coupon_uses_none(): void
    {
        $coupon = $this->coupon();

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertOk();

        $this->assertNull(Order::sole()->coupon_code);
        $this->assertSame(0, $coupon->fresh()->used_count);
    }

    public function test_the_last_use_goes_to_one_order_only(): void
    {
        $coupon = $this->coupon(['max_uses' => 1]);
        $product = $this->createProduct();
        $customer = $this->createCustomer();
        $service = app(OrderService::class);

        $service->place($customer, $this->checkout($product, 'WITAJ10'));

        try {
            $service->place($customer, $this->checkout($product, 'WITAJ10'));
            $this->fail('The limit must hold.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('coupon_code', $e->errors());
        }

        $this->assertSame(1, $coupon->fresh()->used_count);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_guarded_increment_stops_a_race_the_check_did_not_see(): void
    {
        $coupon = $this->coupon(['max_uses' => 1]);
        $customer = $this->createCustomer();

        // A rival order takes the last use between the check and the update.
        $pricing = new class extends CartPricing {
            public function quote(array $items, ?string $coupon = null, ?string $deliveryMethod = null, bool $lock = false): array
            {
                $quote = parent::quote($items, $coupon, $deliveryMethod, $lock);
                DB::table('coupons')->update(['used_count' => 1]);

                return $quote;
            }
        };

        try {
            (new OrderService($pricing))->place($customer, $this->checkout($this->createProduct(), 'WITAJ10'));
            $this->fail('The limit must hold.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('coupon_code', $e->errors());
        }

        $this->assertDatabaseCount('orders', 0);

    }

    public function test_cancelling_gives_the_use_back_once(): void
    {
        $coupon = $this->coupon(['max_uses' => 1]);
        $customer = $this->createCustomer();
        $service = app(OrderService::class);
        $order = $service->place($customer, $this->checkout($this->createProduct(), 'WITAJ10'));
        $this->assertSame(1, $coupon->fresh()->used_count);

        $service->changeStatus($order, 'cancelled');

        $this->assertSame(0, $coupon->fresh()->used_count);

        $this->expectException(ValidationException::class);
        $service->changeStatus($order, 'cancelled');
    }

    public function test_a_stock_failure_does_not_spend_the_coupon(): void
    {
        $coupon = $this->coupon();

        $this->order($this->createProduct([], 0), 'WITAJ10')->assertStatus(422);

        $this->assertSame(0, $coupon->fresh()->used_count);
    }

    public function test_quote_alone_never_spends_a_use(): void
    {
        $coupon = $this->coupon();

        $this->quote($this->createProduct(), 'WITAJ10')->assertOk();

        $this->assertSame(0, $coupon->fresh()->used_count);
    }

    public function test_used_count_is_not_mass_assignable(): void
    {
        $this->assertNotContains('used_count', (new Coupon)->getFillable());
    }

    public function test_like_characters_in_a_code_are_not_wildcards(): void
    {
        $this->coupon();

        $this->quote($this->createProduct(), 'WITAJ%')->assertJsonPath('coupon_error', 'Nieprawidłowy kod rabatowy');
    }

}
