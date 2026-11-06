<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class SensitiveLoggingTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    /** @var list<array{string, array}> */
    private array $logged = [];

    protected function setUp(): void
    {
        parent::setUp();

        Event::listen(MessageLogged::class, function (MessageLogged $event) {
            $this->logged[] = [$event->message, $event->context];
        });
    }

    private function assertNothingSensitiveLogged(array $payload): void
    {
        $output = json_encode($this->logged, JSON_UNESCAPED_UNICODE);

        foreach (['4242', '987', $payload['email'], $payload['first_name'], $payload['last_name'], $payload['phone'], $payload['address'], $payload['password'] ?? 'new-password'] as $secret) {
            $this->assertStringNotContainsString((string) $secret, $output);
        }
    }

    private function payloadWithSecrets(array $overrides = []): array
    {
        return $this->orderPayload($this->createProduct(), array_merge([
            'payment' => [
                'card_number' => '4242 4242 4242 4242',
                'card_name' => 'Jan Kowalski',
                'expiry_date' => now()->addYear()->format('m/y'),
                'cvv' => '987',
            ],
        ], $overrides));
    }

    public function test_successful_order_logs_only_the_order_id(): void
    {
        $payload = $this->payloadWithSecrets();

        $this->postJson('/api/orders', $payload)->assertOk();

        $this->assertNothingSensitiveLogged($payload);
        $this->assertCount(1, $this->logged);
        $this->assertSame(['order_id'], array_keys($this->logged[0][1]));
    }

    public function test_invalid_order_logs_nothing(): void
    {
        $payload = $this->payloadWithSecrets(['delivery_method' => 'drone']);

        $this->postJson('/api/orders', $payload)->assertStatus(422);

        $this->assertSame([], $this->logged);
    }

    public function test_declined_card_logs_nothing(): void
    {
        $payload = $this->payloadWithSecrets();
        $response = $this->postJson('/api/orders', $payload)->assertOk();
        $this->logged = [];

        $this->withToken($response->json('token'))
            ->postJson('/api/orders/' . $response->json('order.id') . '/pay', ['card_last_four' => '0002'])
            ->assertStatus(402);

        $this->assertSame([], $this->logged);
    }

    public function test_successful_payment_logs_only_the_order_id(): void
    {
        $payload = $this->payloadWithSecrets();
        $response = $this->postJson('/api/orders', $payload)->assertOk();
        $this->logged = [];

        $this->withToken($response->json('token'))
            ->postJson('/api/orders/' . $response->json('order.id') . '/pay', ['card_last_four' => '4242'])
            ->assertOk();

        $this->assertNothingSensitiveLogged($payload);
        $this->assertCount(1, $this->logged);
        $this->assertSame(['order_id'], array_keys($this->logged[0][1]));
    }

    public function test_login_logout_and_me_log_nothing(): void
    {
        $customer = $this->createCustomer();

        $this->postJson('/api/customer/login', ['email' => $customer->email, 'password' => 'wrong-password'])
            ->assertStatus(422);
        $token = $this->postJson('/api/customer/login', ['email' => $customer->email, 'password' => $this->customerPassword])
            ->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/customer/me')->assertOk();
        $this->withToken($token)->postJson('/api/customer/logout')->assertOk();

        $this->assertSame([], $this->logged);
    }
}
