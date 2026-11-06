<?php

namespace Tests\Feature;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderPasswordGuessingTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const POLISH_MESSAGE = 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';

    private Customer $victim;

    protected function setUp(): void
    {
        parent::setUp();

        $this->victim = $this->createCustomer();
    }

    private function orderWithPassword(?string $password, ?string $email = null): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'email' => $email ?? $this->victim->email,
            'password' => $password,
        ]));
    }

    private function guessThroughOrders(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->orderWithPassword("wrong-password-{$i}")->assertStatus(422)->assertJsonValidationErrors(['email']);
        }
    }

    private function guessThroughLogin(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->postJson('/api/customer/login', ['email' => $this->victim->email, 'password' => "wrong-{$i}"])
                ->assertStatus(422);
        }
    }

    public function test_sixth_guess_through_orders_is_limited_with_a_polish_429(): void
    {
        $this->guessThroughOrders(5);

        $this->orderWithPassword('wrong-password-6')->assertStatus(429)
            ->assertExactJson(['message' => self::POLISH_MESSAGE])
            ->assertHeader('Retry-After');
    }

    public function test_correct_password_is_refused_too_once_the_budget_is_used(): void
    {
        $this->guessThroughOrders(5);

        $response = $this->orderWithPassword($this->customerPassword);

        $response->assertStatus(429)->assertJsonMissingPath('token');
        $this->assertSame('Anna', $this->victim->fresh()->first_name);
        $this->assertSame(0, $this->victim->tokens()->count());
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_guesses_through_orders_use_up_the_login_budget(): void
    {
        $this->guessThroughOrders(5);

        $this->postJson('/api/customer/login', ['email' => $this->victim->email, 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_guesses_through_login_use_up_the_orders_budget(): void
    {
        $this->guessThroughLogin(5);

        $this->orderWithPassword('wrong-password')->assertStatus(429);
    }

    public function test_both_routes_share_one_budget(): void
    {
        $this->guessThroughLogin(3);
        $this->guessThroughOrders(2);

        $this->orderWithPassword('wrong-password')->assertStatus(429);
    }

    public function test_budget_ignores_email_case(): void
    {
        $this->guessThroughOrders(5);

        $this->postJson('/api/customer/login', ['email' => 'VICTIM@example.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_budget_is_per_email(): void
    {
        $other = $this->createCustomer(['email' => 'other@example.com']);
        $this->guessThroughOrders(5);

        $this->orderWithPassword('wrong-password', $other->email)->assertStatus(422);
    }

    public function test_budget_is_per_ip(): void
    {
        $this->guessThroughOrders(5);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

        $this->orderWithPassword('wrong-password')->assertStatus(422);
    }

    public function test_correct_password_does_not_use_up_the_budget(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->orderWithPassword($this->customerPassword)->assertOk();
        }
    }

    public function test_missing_password_is_not_a_guess(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->orderWithPassword(null)->assertStatus(422);
        }

        $this->orderWithPassword($this->customerPassword)->assertOk();
    }
}
