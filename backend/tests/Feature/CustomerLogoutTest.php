<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\TransientToken;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class CustomerLogoutTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    public function test_logout_deletes_only_the_current_token(): void
    {
        $customer = $this->createCustomer();
        $phone = $customer->createToken('customer-token')->plainTextToken;
        $laptop = $customer->createToken('customer-token')->plainTextToken;

        $this->withToken($phone)->postJson('/api/customer/logout')
            ->assertOk()
            ->assertExactJson(['message' => 'Wylogowano pomyślnie.']);

        $this->assertSame(1, $customer->tokens()->count());

        // The guard caches its user between requests of one test.
        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/customer/me')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->withToken($laptop)->getJson('/api/customer/me')->assertOk();
    }

    public function test_logout_leaves_tokens_of_other_customers_alone(): void
    {
        $customer = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);
        $token = $customer->createToken('customer-token')->plainTextToken;
        $other->createToken('customer-token');

        $this->withToken($token)->postJson('/api/customer/logout')->assertOk();

        $this->assertSame(0, $customer->tokens()->count());
        $this->assertSame(1, $other->tokens()->count());
    }

    public function test_logout_without_a_token_is_unauthorized(): void
    {
        $this->postJson('/api/customer/logout')->assertUnauthorized();
    }

    public function test_logout_survives_a_transient_token_from_a_session_guard(): void
    {
        $customer = $this->createCustomer();
        $other = $customer->createToken('customer-token');
        $customer->withAccessToken(new TransientToken);

        $this->actingAs($customer, 'sanctum')->postJson('/api/customer/logout')->assertOk();

        $this->assertSame(1, $customer->tokens()->count());
        $this->assertNotNull($other->accessToken->fresh());
    }
}
