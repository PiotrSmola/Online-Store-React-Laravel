<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

/**
 * MySQL's utf8mb4_unicode_ci treats víctim@ and victim@ as equal; plain sqlite does not.
 * These tests register a sqlite collation that folds accents the same way, so the
 * controllers run their real queries against a database that behaves like that.
 * The schema changes happen inside the test transaction and are rolled back with it.
 */
class AccentedEmailVariantsTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const COLLATION = 'test_accent_ci';

    private const VARIANTS = [
        'victim@example.com',
        'víctim@example.com',
        'vìctim@example.com',
        'vîctim@example.com',
        'vïctim@example.com',
        'vīctim@example.com',
        'vĭctim@example.com',
    ];

    private Customer $victim;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateCollation(
            self::COLLATION,
            fn (string $a, string $b) => strcmp(Str::lower(Str::ascii($a)), Str::lower(Str::ascii($b)))
        );
        DB::statement('DROP INDEX customers_email_unique');
    }

    // Like MySQL: both the lookup and the unique index ignore accents.
    private function useAccentInsensitiveEmailColumn(): void
    {
        DB::statement('ALTER TABLE customers DROP COLUMN email');
        DB::statement('ALTER TABLE customers ADD COLUMN email VARCHAR COLLATE ' . self::COLLATION);
        DB::statement('CREATE UNIQUE INDEX customers_email_unique ON customers (email)');

        $this->victim = $this->createCustomer();
        $this->product = $this->createProduct();
    }

    // Only the index ignores accents, so the lookup misses a row the insert then collides with.
    private function useAccentInsensitiveUniqueIndexOnly(): void
    {
        DB::statement('CREATE UNIQUE INDEX customers_email_unique ON customers (email COLLATE ' . self::COLLATION . ')');

        $this->victim = $this->createCustomer();
        $this->product = $this->createProduct();
    }

    private function loginAs(string $email, string $password = 'wrong-password'): TestResponse
    {
        return $this->postJson('/api/customer/login', ['email' => $email, 'password' => $password]);
    }

    private function orderAs(string $email, string $password = 'wrong-password'): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($this->product, [
            'email' => $email,
            'password' => $password,
        ]));
    }

    public function test_the_setup_resolves_every_variant_to_the_same_customer(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (self::VARIANTS as $variant) {
            $this->assertSame($this->victim->id, Customer::where('email', $variant)->sole()->id);
        }
    }

    public function test_variants_cannot_exceed_the_budget_on_login(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->loginAs($variant)->assertStatus(422);
        }

        $this->loginAs(self::VARIANTS[5])->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.'])
            ->assertHeader('Retry-After');
    }

    public function test_variants_cannot_exceed_the_budget_on_orders(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->orderAs($variant)->assertStatus(422);
        }

        $this->orderAs(self::VARIANTS[5])->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.'])
            ->assertHeader('Retry-After');
    }

    public function test_both_routes_spend_the_same_budget(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        $this->loginAs(self::VARIANTS[0])->assertStatus(422);
        $this->orderAs(self::VARIANTS[1])->assertStatus(422);
        $this->loginAs(self::VARIANTS[2])->assertStatus(422);
        $this->orderAs(self::VARIANTS[3])->assertStatus(422);
        $this->loginAs(self::VARIANTS[4])->assertStatus(422);

        $this->orderAs(self::VARIANTS[5])->assertStatus(429);
        $this->loginAs(self::VARIANTS[6])->assertStatus(429);
    }

    public function test_login_refuses_before_hash_check_once_the_budget_is_used(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->loginAs($variant)->assertStatus(422);
        }

        Hash::shouldReceive('check')->never();

        $this->loginAs(self::VARIANTS[5], $this->customerPassword)->assertStatus(429);
        $this->assertSame(0, $this->victim->tokens()->count());
    }

    public function test_orders_refuse_before_hash_check_once_the_budget_is_used(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->orderAs($variant)->assertStatus(422);
        }

        Hash::shouldReceive('check')->never();

        $this->orderAs(self::VARIANTS[5], $this->customerPassword)->assertStatus(429);
        $this->assertSame(0, $this->victim->tokens()->count());
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_budget_is_per_ip(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->loginAs($variant)->assertStatus(422);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9']);

        $this->loginAs(self::VARIANTS[5])->assertStatus(422);
    }

    public function test_budget_is_per_customer(): void
    {
        $this->useAccentInsensitiveEmailColumn();
        $other = $this->createCustomer(['email' => 'other@example.com']);

        foreach (array_slice(self::VARIANTS, 0, 5) as $variant) {
            $this->loginAs($variant)->assertStatus(422);
        }

        $this->loginAs($other->email)->assertStatus(422);
    }

    public function test_correct_passwords_do_not_spend_the_budget(): void
    {
        $this->useAccentInsensitiveEmailColumn();

        foreach (self::VARIANTS as $variant) {
            $this->loginAs($variant, $this->customerPassword)->assertOk();
        }

        $this->assertSame(count(self::VARIANTS), $this->victim->tokens()->count());
    }

    public function test_registering_a_duplicate_the_lookup_missed_gets_a_422(): void
    {
        $this->useAccentInsensitiveUniqueIndexOnly();

        $response = $this->orderAs('víctim@example.com', 'new-password');

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
        $response->assertJsonMissingPath('token');
        $this->assertStringContainsString('Zaloguj się', $response->json('errors.email.0'));
        $this->assertDatabaseCount('customers', 1);
        $this->assertSame(0, Order::count());
        $this->assertSame('Anna', $this->victim->fresh()->first_name);
    }
}
