<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderPaymentValidationTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function orderWithCard(array $card): TestResponse
    {
        $payload = $this->orderPayload($this->createProduct());
        $payload['payment'] = array_merge($payload['payment'], $card);

        return $this->postJson('/api/orders', $payload);
    }

    public static function invalidCards(): array
    {
        return [
            'failed Luhn check' => [['card_number' => '4242 4242 4242 4241'], 'payment.card_number', 'Nieprawidłowy numer karty'],
            'too short' => [['card_number' => '4242 42'], 'payment.card_number', 'Numer karty musi mieć od 13 do 19 cyfr'],
            'bad date format' => [['expiry_date' => '1/2030'], 'payment.expiry_date', 'Data ważności musi być w formacie MM/RR'],
            'bad month' => [['expiry_date' => '13/99'], 'payment.expiry_date', 'Nieprawidłowy miesiąc'],
            'expired' => [['expiry_date' => '01/20'], 'payment.expiry_date', 'Karta jest przeterminowana'],
            'bad cvv' => [['cvv' => '12'], 'payment.cvv', 'CVV musi mieć 3-4 cyfry'],
        ];
    }

    #[DataProvider('invalidCards')]
    public function test_invalid_card_gets_422_with_the_error_under_the_key_checkout_reads(
        array $card,
        string $field,
        string $message
    ): void {
        $response = $this->orderWithCard($card);

        $response->assertStatus(422);
        $this->assertSame([$message], $response->json('errors')[$field]);
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_all_card_errors_are_reported_together(): void
    {
        $response = $this->orderWithCard([
            'card_number' => '4242 4242 4242 4241',
            'expiry_date' => '01/20',
            'cvv' => '12',
        ]);

        $response->assertStatus(422);
        $this->assertSame(
            ['payment.card_number', 'payment.cvv', 'payment.expiry_date'],
            collect($response->json('errors'))->keys()->sort()->values()->all()
        );
    }

    public function test_missing_card_fields_are_rejected_for_card_payment(): void
    {
        $response = $this->orderWithCard(['card_number' => '', 'card_name' => '', 'expiry_date' => '', 'cvv' => '']);

        $response->assertStatus(422)->assertJsonValidationErrors([
            'payment.card_number',
            'payment.card_name',
            'payment.expiry_date',
            'payment.cvv',
        ]);
    }

    public function test_only_the_last_four_digits_of_a_card_are_stored(): void
    {
        $this->orderWithCard([])->assertOk();

        $this->assertSame(
            ['method' => 'card', 'card_last_four' => '4242', 'card_name' => 'Jan Kowalski'],
            Order::sole()->payment_details
        );
    }

    public static function offlineMethods(): array
    {
        return [['transfer'], ['cash']];
    }

    #[DataProvider('offlineMethods')]
    public function test_offline_payment_works_with_the_empty_card_fields_checkout_sends(string $method): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'payment_method' => $method,
            'delivery_method' => 'store_pickup',
            'payment' => ['card_number' => '', 'card_name' => '', 'expiry_date' => '', 'cvv' => ''],
        ]));

        $response->assertOk();
        $this->assertSame($method, Order::sole()->payment_details['method']);
    }
}
