<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const POLISH_MESSAGE = 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';

    // Default address of the frontend service in docker-compose.yml.
    private const NGINX_IP = '10.213.47.10';

    private function attemptLogin(string $email = 'victim@example.com'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/customer/login', ['email' => $email, 'password' => 'wrong-password']);
    }

    private function useLogins(int $count, string $email = 'victim@example.com'): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->attemptLogin($email)->assertStatus(422);
        }
    }

    private function useOrders(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->postJson('/api/orders', [])->assertStatus(422);
        }
    }

    public function test_sixth_login_within_a_minute_is_limited(): void
    {
        $this->useLogins(5);

        $this->attemptLogin()->assertStatus(429)
            ->assertExactJson(['message' => self::POLISH_MESSAGE])
            ->assertHeader('Retry-After');
    }

    public function test_correct_password_is_refused_too_once_limited(): void
    {
        $customer = $this->createCustomer();
        $this->useLogins(5, $customer->email);

        $this->postJson('/api/customer/login', ['email' => $customer->email, 'password' => $this->customerPassword])
            ->assertStatus(429);
        $this->assertSame(0, $customer->tokens()->count());
    }

    public function test_login_limit_ignores_email_case(): void
    {
        $this->useLogins(5);

        $this->attemptLogin('VICTIM@example.com')->assertStatus(429);
    }

    public function test_login_limit_is_per_email(): void
    {
        $this->useLogins(5);

        $this->attemptLogin('other@example.com')->assertStatus(422);
    }

    public function test_login_limit_is_per_ip(): void
    {
        $this->useLogins(5);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

        $this->attemptLogin()->assertStatus(422);
    }

    public function test_login_limit_handles_a_non_string_email_and_password(): void
    {
        $this->postJson('/api/customer/login', ['email' => ['a@example.com'], 'password' => ['x']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_twenty_first_order_within_a_minute_is_limited(): void
    {
        $this->useOrders(20);

        $this->postJson('/api/orders', [])->assertStatus(429)
            ->assertExactJson(['message' => self::POLISH_MESSAGE]);
    }

    public function test_order_limit_is_per_ip(): void
    {
        $this->useOrders(20);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

        $this->postJson('/api/orders', [])->assertStatus(422);
    }

    public function test_clients_behind_the_trusted_proxy_are_limited_separately(): void
    {
        config(['trustedproxy.proxies' => self::NGINX_IP]);
        $this->withServerVariables(['REMOTE_ADDR' => self::NGINX_IP]);
        $this->withHeader('X-Forwarded-For', '203.0.113.1');
        $this->useOrders(20);
        $this->postJson('/api/orders', [])->assertStatus(429);

        $this->withHeader('X-Forwarded-For', '203.0.113.2');

        $this->postJson('/api/orders', [])->assertStatus(422);
    }

    public function test_client_cannot_spoof_through_the_trusted_proxy(): void
    {
        config(['trustedproxy.proxies' => self::NGINX_IP]);
        $this->withServerVariables(['REMOTE_ADDR' => self::NGINX_IP]);

        // nginx appends the real peer to whatever the client sent, so only the last entry is genuine.
        $this->withHeader('X-Forwarded-For', '198.51.100.1, 203.0.113.7');
        $this->useOrders(20);

        $this->withHeader('X-Forwarded-For', '198.51.100.2, 203.0.113.7');

        $this->postJson('/api/orders', [])->assertStatus(429);
    }

    public static function untrustedDockerPeers(): array
    {
        return [
            'gateway of the compose network' => ['10.213.47.1'],
            'gateway of another network' => ['172.18.0.1'],
            'another container' => ['10.213.47.3'],
            'Docker Desktop host' => ['192.168.65.1'],
        ];
    }

    #[DataProvider('untrustedDockerPeers')]
    public function test_direct_private_peer_cannot_rotate_the_forwarded_header_on_orders(string $peer): void
    {
        config(['trustedproxy.proxies' => self::NGINX_IP]);
        $this->withServerVariables(['REMOTE_ADDR' => $peer]);
        $this->withHeader('X-Forwarded-For', '198.51.100.1');
        $this->useOrders(20);

        $this->withHeader('X-Forwarded-For', '198.51.100.2');

        $this->postJson('/api/orders', [])->assertStatus(429);
    }

    public function test_direct_private_peer_cannot_rotate_the_forwarded_header_on_login(): void
    {
        config(['trustedproxy.proxies' => self::NGINX_IP]);
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.1']);
        $this->withHeader('X-Forwarded-For', '198.51.100.1');
        $this->useLogins(5);

        $this->withHeader('X-Forwarded-For', '198.51.100.2');

        $this->attemptLogin()->assertStatus(429);
    }

    public function test_no_proxy_is_trusted_by_default(): void
    {
        config(['trustedproxy.proxies' => null]);
        $this->withServerVariables(['REMOTE_ADDR' => self::NGINX_IP]);
        $this->withHeader('X-Forwarded-For', '198.51.100.1');
        $this->useOrders(20);

        $this->withHeader('X-Forwarded-For', '198.51.100.2');

        $this->postJson('/api/orders', [])->assertStatus(429);
    }

    public function test_public_clients_cannot_dodge_the_limit_with_a_forwarded_header(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);
        $this->withHeader('X-Forwarded-For', '198.51.100.1');
        $this->useOrders(20);

        $this->withHeader('X-Forwarded-For', '198.51.100.2');

        $this->postJson('/api/orders', [])->assertStatus(429);
    }
}
