<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

/**
 * Card data no longer reaches the server: the number, expiry and CVV are checked in the
 * frontend simulator and POST /orders/{order}/pay receives only the last four digits.
 */
class OrderPaymentValidationTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function payWith(mixed $body): TestResponse
    {
        $order = $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertOk();

        return $this->withToken($order->json('token'))
            ->postJson('/api/orders/' . $order->json('order.id') . '/pay', $body);
    }

    public static function invalidLastFour(): array
    {
        return [
            'too short' => [['card_last_four' => '424']],
            'too long' => [['card_last_four' => '42424']],
            'letters' => [['card_last_four' => '42a2']],
            'a whole card number' => [['card_last_four' => '4242424242424242']],
            'a number instead of a string' => [['card_last_four' => 4242]],
            'non ascii digits' => [['card_last_four' => '٤٢٤٢']],
            'a list' => [['card_last_four' => ['4242']]],
            'missing' => [[]],
        ];
    }

    #[DataProvider('invalidLastFour')]
    public function test_invalid_last_four_digits_get_422_and_change_nothing(array $body): void
    {
        $this->payWith($body)->assertStatus(422)->assertJsonValidationErrors(['card_last_four']);

        $order = Order::sole();
        $this->assertSame('unpaid', $order->payment_status);
        $this->assertSame(['method' => 'card'], $order->payment_details);
    }

    public function test_only_the_last_four_digits_of_a_card_are_stored(): void
    {
        $this->payWith(['card_last_four' => '4242'])->assertOk();

        $this->assertSame(['method' => 'card', 'card_last_four' => '4242'], Order::sole()->payment_details);
    }

    public function test_card_fields_sent_to_the_order_endpoint_are_ignored_and_never_stored(): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'card_last_four' => '1234',
            'payment' => [
                'card_number' => '4242 4242 4242 4242',
                'card_name' => 'Jan Kowalski',
                'expiry_date' => '12/99',
                'cvv' => '987',
            ],
        ]));

        $response->assertOk();
        $stored = Order::sole();
        $this->assertSame(['method' => 'card'], $stored->payment_details);
        $this->assertSame('unpaid', $stored->payment_status);
        $this->assertStringNotContainsString('4242', json_encode($stored->getAttributes()));
        $this->assertStringNotContainsString('987', (string) $stored->getRawOriginal('payment_details'));
    }

    public function test_card_order_does_not_need_any_card_fields(): void
    {
        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertOk();

        $this->assertSame('card', Order::sole()->payment_method);
    }

    public static function offlineMethods(): array
    {
        return [['transfer'], ['cash']];
    }

    #[DataProvider('offlineMethods')]
    public function test_offline_payment_needs_no_card_fields(string $method): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'payment_method' => $method,
            'delivery_method' => 'store_pickup',
        ]));

        $response->assertOk();
        $this->assertSame($method, Order::sole()->payment_details['method']);
        $this->assertArrayHasKey('instructions', Order::sole()->payment_details);
    }

    public function test_transfer_instructions_use_the_configured_account(): void
    {
        $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), ['payment_method' => 'transfer']))
            ->assertOk();

        $this->assertStringContainsString(config('shop.bank_account'), Order::sole()->payment_details['instructions']);
    }
}
