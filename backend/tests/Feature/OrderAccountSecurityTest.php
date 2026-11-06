<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderAccountSecurityTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function assertCustomerUntouched(Customer $customer, TestResponse $response): void
    {
        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
        $this->assertStringContainsString('Zaloguj się', $response->json('errors.email.0'));
        $response->assertJsonMissingPath('token');

        $fresh = $customer->fresh();
        $this->assertSame('Anna', $fresh->first_name);
        $this->assertSame('Stara 1', $fresh->address);
        $this->assertTrue(Hash::check($this->customerPassword, $fresh->password));
        $this->assertSame(0, $fresh->tokens()->count());
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_takeover_with_existing_email_and_no_password_is_rejected(): void
    {
        $victim = $this->createCustomer();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => null,
            'first_name' => 'Attacker',
            'address' => 'Attacker street',
        ]));

        $this->assertCustomerUntouched($victim, $response);
    }

    public function test_existing_email_with_empty_password_as_sent_by_checkout_is_rejected(): void
    {
        $victim = $this->createCustomer();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => '',
            'first_name' => 'Attacker',
        ]));

        $this->assertCustomerUntouched($victim, $response);
    }

    public function test_existing_email_with_wrong_password_is_rejected(): void
    {
        $victim = $this->createCustomer();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => 'wrong-password',
            'first_name' => 'Attacker',
        ]));

        $this->assertCustomerUntouched($victim, $response);
    }

    public function test_existing_email_with_short_wrong_password_is_told_to_log_in(): void
    {
        $victim = $this->createCustomer();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => 'abc',
            'first_name' => 'Attacker',
        ]));

        $this->assertCustomerUntouched($victim, $response);
    }

    public function test_existing_email_with_invalid_token_and_no_password_is_rejected(): void
    {
        $victim = $this->createCustomer();

        $response = $this->withToken('1|not-a-real-token')->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => null,
            'first_name' => 'Attacker',
        ]));

        $this->assertCustomerUntouched($victim, $response);
    }

    public function test_new_customer_can_order_and_receives_a_working_token(): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct()));

        $response->assertOk()->assertJsonPath('customer.email', 'new@example.com');
        $response->assertJsonMissingPath('customer.password');

        $customer = Customer::where('email', 'new@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('new-password', $customer->password));
        $this->assertSame($customer->id, Order::sole()->customer_id);
        $this->assertSame(1, Order::sole()->items()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($response->json('token'))->getJson('/api/customer/me')
            ->assertOk()->assertJsonPath('id', $customer->id);
    }

    public function test_new_customer_needs_a_password_of_at_least_eight_characters(): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'password' => 'seven77',
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->assertDatabaseCount('customers', 0);

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'password' => 'eight888',
        ]))->assertOk();
    }

    public function test_existing_customer_with_correct_password_can_order_and_receives_a_token(): void
    {
        $customer = $this->createCustomer();

        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $customer->email,
            'password' => $this->customerPassword,
            'address' => 'Nowy adres 5',
        ]));

        $response->assertOk()->assertJsonPath('customer.id', $customer->id);
        $this->assertNotEmpty($response->json('token'));
        $this->assertSame(1, $customer->tokens()->count());
        $this->assertSame('Nowy adres 5', $customer->fresh()->address);
        $this->assertSame($customer->id, Order::sole()->customer_id);
    }

    public function test_logged_in_customer_can_order_without_a_new_token(): void
    {
        $customer = $this->createCustomer();
        $token = $customer->createToken('customer-token')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $customer->email,
            'password' => '',
            'address' => 'Nowy adres 5',
        ]));

        $response->assertOk()->assertJsonPath('customer.id', $customer->id);
        $response->assertJsonMissingPath('token');
        $this->assertSame(1, $customer->tokens()->count());
        $this->assertSame('Nowy adres 5', $customer->fresh()->address);
        $this->assertSame($customer->id, Order::sole()->customer_id);
    }

    public function test_logged_in_customer_does_not_need_an_email_in_the_body(): void
    {
        $customer = $this->createCustomer();
        $token = $customer->createToken('customer-token')->plainTextToken;
        $payload = $this->orderPayload($this->createProduct());
        unset($payload['email'], $payload['password']);

        $this->withToken($token)->postJson('/api/orders', $payload)->assertOk();

        $this->assertSame($customer->id, Order::sole()->customer_id);
    }

    public function test_token_wins_over_the_email_in_the_body(): void
    {
        $victim = $this->createCustomer();
        $customer = $this->createCustomer(['email' => 'owner@example.com', 'first_name' => 'Ewa']);
        $token = $customer->createToken('customer-token')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $victim->email,
            'password' => null,
            'first_name' => 'Zmieniona',
        ]));

        $response->assertOk()->assertJsonPath('customer.id', $customer->id);
        $this->assertSame($customer->id, Order::sole()->customer_id);
        $this->assertSame('Anna', $victim->fresh()->first_name);
        $this->assertSame(0, $victim->tokens()->count());
        $this->assertSame('owner@example.com', $customer->fresh()->email);
        $this->assertSame('Zmieniona', $customer->fresh()->first_name);
    }
}
