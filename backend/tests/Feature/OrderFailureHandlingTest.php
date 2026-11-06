<?php

namespace Tests\Feature;

use App\Models\OrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderFailureHandlingTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const SECRET_MESSAGE = 'SQLSTATE[23000] insert values (new@example.com, $2y$hash)';

    private function failWhenCreatingOrderItems(): void
    {
        OrderItem::creating(function () {
            throw new \RuntimeException(self::SECRET_MESSAGE);
        });
    }

    public function test_server_error_returns_a_generic_polish_message(): void
    {
        $this->failWhenCreatingOrderItems();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct()));

        $response->assertStatus(500)
            ->assertExactJson(['message' => 'Nie udało się złożyć zamówienia. Spróbuj ponownie później.']);
    }

    public function test_server_error_rolls_back_a_new_customer_and_the_order(): void
    {
        $this->failWhenCreatingOrderItems();

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertStatus(500);

        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_server_error_rolls_back_updates_of_an_existing_customer(): void
    {
        $this->failWhenCreatingOrderItems();
        $customer = $this->createCustomer();

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $customer->email,
            'password' => $this->customerPassword,
        ]))->assertStatus(500);

        $this->assertSame('Anna', $customer->fresh()->first_name);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_server_error_is_logged_without_exception_message_or_request_data(): void
    {
        $this->failWhenCreatingOrderItems();
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged) {
            $logged[] = $event;
        });

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertStatus(500);

        $errors = array_values(array_filter($logged, fn (MessageLogged $event) => $event->level === 'error'));
        $this->assertCount(1, $errors);
        $this->assertSame(\RuntimeException::class, $errors[0]->context['exception_class']);

        $output = json_encode(array_map(fn (MessageLogged $event) => [$event->message, $event->context], $errors));
        $this->assertStringNotContainsString('SQLSTATE', $output);
        $this->assertStringNotContainsString('new@example.com', $output);
    }

    public function test_missing_password_for_a_new_customer_writes_nothing(): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'password' => '',
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
    }
}
