<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Notifications\CustomerResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class CustomerAccountTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private const NEW_PASSWORD = 'brand-new-password';

    private function register(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/customer/register', array_merge([
            'email' => 'nowy@example.com',
            'password' => 'bezpieczne-haslo',
            'password_confirmation' => 'bezpieczne-haslo',
            'first_name' => 'Ola',
            'last_name' => 'Wiśniewska',
        ], $overrides));
    }

    // Registration

    public function test_registration_needs_no_address_and_returns_a_working_token(): void
    {
        $response = $this->register()->assertCreated()
            ->assertJsonPath('customer.email', 'nowy@example.com')
            ->assertJsonPath('customer.is_admin', false)
            ->assertJsonMissingPath('customer.password');

        $customer = Customer::sole();
        $this->assertNull($customer->address);
        $this->assertNull($customer->city);
        $this->assertNull($customer->postal_code);
        $this->assertSame('Polska', $customer->fresh()->country);
        $this->assertTrue(Hash::check('bezpieczne-haslo', $customer->password));

        $this->app['auth']->forgetGuards();
        $this->withToken($response->json('token'))->getJson('/api/customer/me')->assertOk();
    }

    public function test_is_admin_cannot_be_registered(): void
    {
        $this->register(['is_admin' => true])->assertCreated();

        $this->assertFalse(Customer::sole()->fresh()->is_admin);
    }

    public function test_is_admin_is_not_fillable(): void
    {
        $this->assertNotContains('is_admin', (new Customer)->getFillable());
    }

    public function test_duplicate_email_is_refused_in_polish(): void
    {
        $this->createCustomer(['email' => 'nowy@example.com']);

        $response = $this->register()->assertStatus(422)->assertJsonValidationErrors(['email']);

        $this->assertStringContainsString('już istnieje', $response->json('errors.email.0'));
        $this->assertDatabaseCount('customers', 1);
    }

    public static function badPasswords(): array
    {
        return [
            'seven characters' => [['password' => 'siedem7', 'password_confirmation' => 'siedem7']],
            'unconfirmed' => [['password_confirmation' => 'inne-haslo']],
            'missing confirmation' => [['password_confirmation' => null]],
        ];
    }

    #[DataProvider('badPasswords')]
    public function test_bad_passwords_are_refused(array $overrides): void
    {
        $this->register($overrides)->assertStatus(422)->assertJsonValidationErrors(['password']);
        $this->assertDatabaseCount('customers', 0);
    }

    public function test_company_registration_needs_a_name_and_nip(): void
    {
        $this->register(['customer_type' => 'company'])
            ->assertStatus(422)->assertJsonValidationErrors(['company_name', 'nip']);

        $this->register(['customer_type' => 'company', 'company_name' => 'Firma', 'nip' => '123'])->assertCreated();
    }

    public function test_registration_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->register(['email' => "konto{$i}@example.com"])->assertCreated();
        }

        $this->register(['email' => 'konto6@example.com'])->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);
    }

    // Forgot and reset password

    public function test_forgot_password_gives_the_same_reply_for_known_and_unknown_addresses(): void
    {
        Notification::fake();
        $customer = $this->createCustomer();

        $known = $this->postJson('/api/customer/forgot-password', ['email' => $customer->email])->assertOk();
        $unknown = $this->postJson('/api/customer/forgot-password', ['email' => 'nikt@example.com'])->assertOk();

        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentTo($customer, CustomerResetPassword::class);
        Notification::assertCount(1);
    }

    public function test_a_second_request_within_the_throttle_window_looks_the_same(): void
    {
        Notification::fake();
        $customer = $this->createCustomer();

        $first = $this->postJson('/api/customer/forgot-password', ['email' => $customer->email]);
        $second = $this->postJson('/api/customer/forgot-password', ['email' => $customer->email]);

        $this->assertSame($first->json(), $second->json());
        Notification::assertCount(1);
    }

    public function test_reset_link_points_at_the_frontend_and_the_mail_is_polish(): void
    {
        Notification::fake();
        config(['app.url' => 'http://shop.test']);
        $customer = $this->createCustomer();

        $this->postJson('/api/customer/forgot-password', ['email' => $customer->email])->assertOk();

        Notification::assertSentTo($customer, function (CustomerResetPassword $notification) use ($customer) {
            $mail = $notification->toMail($customer);
            $html = (string) $mail->render();
            $expected = "http://shop.test/reset-password?token={$notification->token}&email=" . urlencode($customer->email);

            $this->assertSame('Zmiana hasła', $mail->subject);
            $this->assertStringContainsString(e($expected), $html);
            $this->assertStringContainsString('Ustaw nowe hasło', $html);

            return true;
        });
    }

    public function test_reset_notification_is_queued(): void
    {
        $this->assertInstanceOf(\Illuminate\Contracts\Queue\ShouldQueue::class, new CustomerResetPassword('token'));
    }

    private function resetToken(Customer $customer): string
    {
        return Password::broker('customers')->createToken($customer);
    }

    private function reset(Customer $customer, string $token, array $overrides = []): TestResponse
    {
        return $this->postJson('/api/customer/reset-password', array_merge([
            'token' => $token,
            'email' => $customer->email,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ], $overrides));
    }

    public function test_reset_changes_the_password_and_revokes_every_token(): void
    {
        $customer = $this->createCustomer();
        $customer->createToken('customer-token');
        $customer->createToken('customer-token');

        $this->reset($customer, $this->resetToken($customer))->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $customer->fresh()->password));
        $this->assertSame(0, $customer->tokens()->count());
    }

    public function test_reset_token_works_only_once(): void
    {
        $customer = $this->createCustomer();
        $token = $this->resetToken($customer);

        $this->reset($customer, $token)->assertOk();

        $this->reset($customer, $token, ['password' => 'another-password', 'password_confirmation' => 'another-password'])
            ->assertStatus(422)->assertJsonValidationErrors(['email']);
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $customer->fresh()->password));
    }

    public function test_reset_with_a_wrong_token_or_foreign_email_is_refused(): void
    {
        $customer = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);
        $token = $this->resetToken($customer);

        $this->reset($customer, 'wrong-token')->assertStatus(422);
        $this->reset($other, $token)->assertStatus(422);

        $this->assertTrue(Hash::check($this->customerPassword, $customer->fresh()->password));
        $this->assertTrue(Hash::check($this->customerPassword, $other->fresh()->password));
    }

    public function test_expired_reset_token_is_refused(): void
    {
        $customer = $this->createCustomer();
        $token = $this->resetToken($customer);
        $this->travel(61)->minutes();

        $this->reset($customer, $token)->assertStatus(422);
    }

    public function test_reset_keeps_the_password_rules(): void
    {
        $customer = $this->createCustomer();

        $this->reset($customer, $this->resetToken($customer), ['password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_reset_uses_the_existing_token_table(): void
    {
        $customer = $this->createCustomer();
        $this->resetToken($customer);

        $this->assertDatabaseHas('password_reset_tokens', ['email' => $customer->email]);
    }

    public function test_forgot_and_reset_are_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/customer/forgot-password', ['email' => "x{$i}@example.com"])->assertOk();
        }
        $this->postJson('/api/customer/forgot-password', ['email' => 'y@example.com'])->assertStatus(429);

        $customer = $this->createCustomer();
        for ($i = 0; $i < 10; $i++) {
            $this->reset($customer, "guess-{$i}")->assertStatus(422);
        }
        $this->reset($customer, 'guess-11')->assertStatus(429);
    }

    // Profile

    public function test_profile_can_be_updated(): void
    {
        $customer = $this->createCustomer();

        $this->actingAs($customer, 'sanctum')->putJson('/api/customer/profile', [
            'first_name' => 'Zofia',
            'city' => 'Poznań',
        ])->assertOk()->assertJsonPath('first_name', 'Zofia')->assertJsonPath('last_name', 'Nowak');

        $this->assertSame('Poznań', $customer->fresh()->city);
    }

    public function test_address_can_be_cleared(): void
    {
        $customer = $this->createCustomer();

        $this->actingAs($customer, 'sanctum')->putJson('/api/customer/profile', ['address' => null])->assertOk();

        $this->assertNull($customer->fresh()->address);
    }

    public function test_profile_ignores_fields_it_does_not_own(): void
    {
        $customer = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);

        $this->actingAs($customer, 'sanctum')->putJson('/api/customer/profile', [
            'id' => $other->id,
            'email' => 'hacked@example.com',
            'password' => 'hacked-password',
            'is_admin' => true,
            'first_name' => 'Zofia',
        ])->assertOk();

        $fresh = $customer->fresh();
        $this->assertSame('victim@example.com', $fresh->email);
        $this->assertFalse($fresh->is_admin);
        $this->assertTrue(Hash::check($this->customerPassword, $fresh->password));
        $this->assertSame('Anna', $other->fresh()->first_name);
    }

    public function test_company_profile_needs_a_name_and_nip(): void
    {
        $this->actingAs($this->createCustomer(), 'sanctum')
            ->putJson('/api/customer/profile', ['customer_type' => 'company'])
            ->assertStatus(422)->assertJsonValidationErrors(['company_name', 'nip']);
    }

    public function test_account_routes_need_a_login(): void
    {
        $this->putJson('/api/customer/profile', ['first_name' => 'X'])->assertUnauthorized();
        $this->putJson('/api/customer/password', [])->assertUnauthorized();
    }

    // Password change

    private function changePassword(string $token, string $current): TestResponse
    {
        return $this->withToken($token)->putJson('/api/customer/password', [
            'current_password' => $current,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ]);
    }

    public function test_password_change_revokes_other_tokens_and_keeps_the_current_one(): void
    {
        $customer = $this->createCustomer();
        $phone = $customer->createToken('customer-token')->plainTextToken;
        $laptop = $customer->createToken('customer-token')->plainTextToken;

        $this->changePassword($phone, $this->customerPassword)->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $customer->fresh()->password));
        $this->assertSame(1, $customer->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($phone)->getJson('/api/customer/me')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($laptop)->getJson('/api/customer/me')->assertUnauthorized();
    }

    public function test_password_change_needs_the_current_password(): void
    {
        $customer = $this->createCustomer();
        $token = $customer->createToken('customer-token')->plainTextToken;

        $this->changePassword($token, 'wrong-password')
            ->assertStatus(422)->assertJsonValidationErrors(['current_password']);

        $this->assertTrue(Hash::check($this->customerPassword, $customer->fresh()->password));
    }

    public function test_guessing_the_current_password_shares_the_login_budget(): void
    {
        $customer = $this->createCustomer();
        $token = $customer->createToken('customer-token')->plainTextToken;

        for ($i = 0; $i < 5; $i++) {
            $this->changePassword($token, "wrong-{$i}")->assertStatus(422);
        }

        $this->changePassword($token, $this->customerPassword)->assertStatus(429);
        $this->assertTrue(Hash::check($this->customerPassword, $customer->fresh()->password));
    }

    // Tokens

    public function test_tokens_expire_after_seven_days(): void
    {
        $this->assertSame(60 * 24 * 7, config('sanctum.expiration'));

        $customer = $this->createCustomer();
        $token = $customer->createToken('customer-token')->plainTextToken;

        $this->travel(7 * 24 * 60 - 1)->minutes();
        $this->withToken($token)->getJson('/api/customer/me')->assertOk();

        $this->travel(2)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/customer/me')->assertUnauthorized();
    }

    public function test_login_and_me_expose_the_admin_flag_for_the_frontend(): void
    {
        $customer = $this->createCustomer();
        $customer->forceFill(['is_admin' => true])->save();

        $this->postJson('/api/customer/login', ['email' => $customer->email, 'password' => $this->customerPassword])
            ->assertOk()->assertJsonPath('customer.is_admin', true);
    }

    // CORS

    public function test_cors_allows_configured_origins_only(): void
    {
        $this->assertNotContains('*', config('cors.allowed_origins'));

        $this->call('OPTIONS', '/api/products', [], [], [], [
            'HTTP_ORIGIN' => 'http://localhost:5173',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ])->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');

        $this->call('OPTIONS', '/api/products', [], [], [], [
            'HTTP_ORIGIN' => 'http://evil.example',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ])->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_a_wildcard_in_the_environment_is_ignored(): void
    {
        $_ENV['CORS_ALLOWED_ORIGINS'] = $_SERVER['CORS_ALLOWED_ORIGINS'] = '*,http://shop.test';

        try {
            $origins = (require base_path('config/cors.php'))['allowed_origins'];
        } finally {
            unset($_ENV['CORS_ALLOWED_ORIGINS'], $_SERVER['CORS_ALLOWED_ORIGINS']);
        }

        $this->assertSame(['http://shop.test'], $origins);
    }

    // Logging and errors

    public function test_a_failed_query_reaches_neither_the_log_nor_the_client_with_its_bindings(): void
    {
        config(['app.debug' => false]);
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged) {
            $logged[] = [$event->message, $event->context];
        });
        Route::get('/api/test-query-failure', fn () => DB::table('nope')->where('email', 'tajny@example.com')->get());

        $response = $this->getJson('/api/test-query-failure')->assertStatus(500);

        $this->assertSame(['message' => 'Wystąpił błąd serwera. Spróbuj ponownie później.'], $response->json());
        $this->assertStringNotContainsString('tajny@example.com', json_encode($logged));
        $this->assertSame('Database query failed', $logged[0][0] ?? null);
    }

    public function test_mail_is_not_touched_by_account_routes(): void
    {
        Mail::fake();

        $this->register()->assertCreated();

        Mail::assertNothingOutgoing();
    }
}
