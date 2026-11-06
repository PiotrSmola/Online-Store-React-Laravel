<?php

namespace Tests\Feature;

use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use App\Support\CsvCell;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class NewsletterTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, CountsQueries, RefreshDatabase;

    private function subscribe(string $email = 'czytelnik@example.com', array $extra = []): TestResponse
    {
        return $this->postJson('/api/newsletter/subscribe', ['email' => $email] + $extra);
    }

    private function subscriber(array $attributes = []): NewsletterSubscriber
    {
        $subscriber = NewsletterSubscriber::create([
            'email' => $attributes['email'] ?? 'czytelnik@example.com',
            'confirm_token' => array_key_exists('confirmed_at', $attributes) ? null : Str::random(64),
            'unsubscribe_token' => Str::random(64),
        ]);

        return $subscriber->forceFill(['confirmed_at' => $attributes['confirmed_at'] ?? null]);
    }

    private function confirmed(string $email = 'czytelnik@example.com'): NewsletterSubscriber
    {
        return tap($this->subscriber(['email' => $email, 'confirmed_at' => now()]))->save();
    }

    // Subscribing

    public function test_subscribing_stores_an_unconfirmed_address_and_queues_a_confirmation(): void
    {
        Mail::fake();

        $this->subscribe()->assertOk();

        $subscriber = NewsletterSubscriber::sole();
        $this->assertNull($subscriber->confirmed_at);
        $this->assertSame(64, strlen($subscriber->confirm_token));
        $this->assertSame(64, strlen($subscriber->unsubscribe_token));
        Mail::assertQueued(NewsletterConfirmation::class, fn ($mail) => $mail->hasTo('czytelnik@example.com'));
    }

    public function test_the_reply_is_the_same_for_new_pending_and_confirmed_addresses(): void
    {
        Mail::fake();
        $this->confirmed('potwierdzony@example.com');
        $this->subscriber(['email' => 'oczekujacy@example.com'])->save();

        $replies = array_map(function (string $email) {
            $response = $this->subscribe($email)->assertOk();

            return [$response->status(), $response->json()];
        }, ['nowy@example.com', 'oczekujacy@example.com', 'potwierdzony@example.com']);

        $this->assertSame($replies[0], $replies[1]);
        $this->assertSame($replies[0], $replies[2]);
        $this->assertSame(['message'], array_keys($replies[0][1]));
    }

    public function test_a_confirmed_address_gets_no_further_mail(): void
    {
        Mail::fake();
        $this->confirmed();

        $this->subscribe()->assertOk();

        Mail::assertNothingOutgoing();
    }

    public function test_a_repeated_request_does_not_flood_the_inbox(): void
    {
        Mail::fake();

        $this->subscribe()->assertOk();
        $this->subscribe()->assertOk();
        $this->subscribe()->assertOk();

        Mail::assertQueued(NewsletterConfirmation::class, 1);
        $this->assertDatabaseCount('newsletter_subscribers', 1);
    }

    public function test_the_confirmation_can_be_sent_again_after_the_cool_down(): void
    {
        Mail::fake();
        $this->subscribe()->assertOk();

        $this->travel(11)->minutes();
        $this->subscribe()->assertOk();

        Mail::assertQueued(NewsletterConfirmation::class, 2);
    }

    public function test_an_address_is_stored_once_whatever_its_case(): void
    {
        Mail::fake();

        $this->subscribe('Czytelnik@Example.com')->assertOk();
        $this->subscribe('czytelnik@example.com')->assertOk();

        $this->assertSame('czytelnik@example.com', NewsletterSubscriber::sole()->email);
    }

    public function test_a_body_cannot_mark_itself_confirmed(): void
    {
        Mail::fake();

        $this->subscribe('czytelnik@example.com', ['confirmed_at' => now()->toDateTimeString()])->assertOk();

        $this->assertNull(NewsletterSubscriber::sole()->confirmed_at);
    }

    public function test_bad_addresses_are_refused_in_polish(): void
    {
        $response = $this->subscribe('to nie adres')->assertStatus(422)->assertJsonValidationErrors(['email']);

        $this->assertStringContainsString('adresem e-mail', $response->json('errors.email.0'));
    }

    public function test_an_address_with_a_header_injection_attempt_is_refused(): void
    {
        $this->subscribe("a@example.com\r\nBcc: ofiara@example.com")->assertStatus(422);

        $this->assertDatabaseCount('newsletter_subscribers', 0);
    }

    public function test_a_mail_failure_does_not_change_the_reply(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down'));

        $this->subscribe()->assertOk();
    }

    public function test_nothing_about_the_address_is_logged(): void
    {
        Mail::fake();
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged) {
            $logged[] = $event;
        });

        $this->subscribe()->assertOk();

        $this->assertSame([], $logged);
    }

    public function test_subscribing_is_rate_limited(): void
    {
        Mail::fake();

        for ($i = 0; $i < 5; $i++) {
            $this->subscribe("a{$i}@example.com")->assertOk();
        }

        $this->subscribe('a6@example.com')->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);
    }

    // The email

    public function test_the_email_links_to_the_frontend_and_offers_unsubscribing(): void
    {
        Mail::fake();
        config(['app.url' => 'http://shop.test/']);

        $this->subscribe()->assertOk();

        $subscriber = NewsletterSubscriber::sole();

        Mail::assertQueued(NewsletterConfirmation::class, function (NewsletterConfirmation $mail) use ($subscriber) {
            $html = $mail->render();

            $this->assertStringContainsString("http://shop.test/newsletter/confirm?token={$subscriber->confirm_token}", $html);
            $this->assertStringContainsString("http://shop.test/newsletter/unsubscribe?token={$subscriber->unsubscribe_token}", $html);
            $this->assertStringContainsString('Wypisz się', $html);

            return true;
        });
    }

    // Confirming

    public function test_the_token_confirms_the_address_and_works_once(): void
    {
        $subscriber = $this->subscriber();
        $subscriber->save();
        $token = $subscriber->confirm_token;

        $this->postJson('/api/newsletter/confirm', ['token' => $token])->assertOk();

        $fresh = $subscriber->fresh();
        $this->assertNotNull($fresh->confirmed_at);
        $this->assertNull($fresh->confirm_token);

        $this->postJson('/api/newsletter/confirm', ['token' => $token])
            ->assertStatus(422)->assertJsonValidationErrors(['token']);
    }

    public function test_a_wrong_token_confirms_nothing(): void
    {
        $subscriber = $this->subscriber();
        $subscriber->save();

        $this->postJson('/api/newsletter/confirm', ['token' => str_repeat('x', 64)])->assertStatus(422);
        $this->postJson('/api/newsletter/confirm', [])->assertStatus(422)->assertJsonValidationErrors(['token']);
        $this->postJson('/api/newsletter/confirm', ['token' => ['a']])->assertStatus(422);

        $this->assertNull($subscriber->fresh()->confirmed_at);
    }

    public function test_a_null_token_cannot_match_a_confirmed_row(): void
    {
        $this->confirmed();

        $this->postJson('/api/newsletter/confirm', ['token' => null])->assertStatus(422);
    }

    public function test_the_unsubscribe_token_does_not_confirm(): void
    {
        $subscriber = $this->subscriber();
        $subscriber->save();

        $this->postJson('/api/newsletter/confirm', ['token' => $subscriber->unsubscribe_token])->assertStatus(422);

        $this->assertNull($subscriber->fresh()->confirmed_at);
    }

    // Unsubscribing

    public function test_unsubscribing_removes_the_address(): void
    {
        $subscriber = $this->confirmed();

        $this->postJson('/api/newsletter/unsubscribe', ['token' => $subscriber->unsubscribe_token])->assertOk();

        $this->assertDatabaseCount('newsletter_subscribers', 0);
    }

    public function test_an_unconfirmed_address_can_unsubscribe_too(): void
    {
        $subscriber = $this->subscriber();
        $subscriber->save();

        $this->postJson('/api/newsletter/unsubscribe', ['token' => $subscriber->unsubscribe_token])->assertOk();

        $this->assertDatabaseCount('newsletter_subscribers', 0);
    }

    public function test_a_wrong_token_removes_nothing(): void
    {
        $this->confirmed();

        $this->postJson('/api/newsletter/unsubscribe', ['token' => str_repeat('x', 64)])
            ->assertStatus(422)->assertJsonValidationErrors(['token']);

        $this->assertDatabaseCount('newsletter_subscribers', 1);
    }

    public function test_someone_who_left_can_subscribe_again_and_must_confirm_again(): void
    {
        Mail::fake();
        $subscriber = $this->confirmed();
        $this->postJson('/api/newsletter/unsubscribe', ['token' => $subscriber->unsubscribe_token])->assertOk();

        $this->subscribe()->assertOk();

        $this->assertNull(NewsletterSubscriber::sole()->confirmed_at);
        Mail::assertQueued(NewsletterConfirmation::class, 1);
    }

    public function test_both_token_routes_share_one_rate_limit(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/newsletter/confirm', ['token' => "zgadywany-{$i}"])->assertStatus(422);
            $this->postJson('/api/newsletter/unsubscribe', ['token' => "zgadywany-{$i}"])->assertStatus(422);
        }

        $this->postJson('/api/newsletter/confirm', ['token' => 'zgadywany'])->assertStatus(429);
        $this->postJson('/api/newsletter/unsubscribe', ['token' => 'zgadywany'])->assertStatus(429);
    }

    // Admin

    public function test_admin_list_searches_paginates_and_hides_tokens(): void
    {
        $this->confirmed('anna@example.com');
        $this->subscriber(['email' => 'piotr@example.com'])->save();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $this->getJson('/api/admin/newsletter')->assertOk()->assertJsonPath('total', 2)->assertJsonPath('per_page', 20);

        $row = $this->getJson('/api/admin/newsletter?q=anna')->assertJsonPath('total', 1)->json('data.0');
        $this->assertSame(['id', 'email', 'confirmed_at', 'created_at'], array_keys($row));
    }

    public function test_admin_search_escapes_wildcards(): void
    {
        $this->confirmed();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $this->getJson('/api/admin/newsletter?q=' . rawurlencode('%'))->assertJsonPath('total', 0);
    }

    public function test_tokens_never_serialize(): void
    {
        $json = $this->confirmed()->toJson();

        $this->assertStringNotContainsString('token', $json);
    }

    public function test_export_holds_confirmed_addresses_only(): void
    {
        $this->confirmed('potwierdzony@example.com');
        $this->subscriber(['email' => 'oczekujacy@example.com'])->save();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $response = $this->get('/api/admin/newsletter/export')->assertOk();

        $csv = $response->streamedContent();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename=newsletter-', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('potwierdzony@example.com', $csv);
        $this->assertStringNotContainsString('oczekujacy@example.com', $csv);
        $this->assertStringNotContainsString('token', $csv);
        $this->assertSame('email,confirmed_at', strtok($csv, "\n"));
    }

    public static function dangerousCells(): array
    {
        return [
            'equals' => ['=HYPERLINK("http://evil")@example.com'],
            'plus' => ['+1+1@example.com'],
            'minus' => ['-2+3@example.com'],
            'at' => ['@SUM(1)'],
            'tab' => ["\t=1+1"],
            'carriage return' => ["\r=1+1"],
            'new line' => ["\n=1+1"],
            'full width equals' => ['＝1+1'],
        ];
    }

    #[DataProvider('dangerousCells')]
    public function test_cells_that_look_like_formulas_become_text(string $value): void
    {
        $this->assertSame("'" . $value, CsvCell::safe($value));
    }

    public function test_ordinary_addresses_stay_as_they_are(): void
    {
        $this->assertSame('jan.kowalski@example.com', CsvCell::safe('jan.kowalski@example.com'));
    }

    public function test_a_formula_address_that_passed_validation_is_neutralised_in_the_export(): void
    {
        Mail::fake();
        $this->subscribe('=cmd@example.com')->assertOk();
        NewsletterSubscriber::query()->update(['confirmed_at' => now()]);
        $this->actingAs($this->createAdmin(), 'sanctum');

        $csv = $this->get('/api/admin/newsletter/export')->assertOk()->streamedContent();

        $this->assertStringContainsString("'=cmd@example.com", $csv);
        $this->assertDoesNotMatchRegularExpression('/^=cmd/m', $csv);
    }

    public function test_export_reads_in_batches_and_query_count_is_not_per_row(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->confirmed("a{$i}@example.com");
        }
        $this->actingAs($this->createAdmin(), 'sanctum');

        $small = $this->countQueries(fn () => $this->get('/api/admin/newsletter/export')->streamedContent());

        for ($i = 5; $i < 50; $i++) {
            $this->confirmed("a{$i}@example.com");
        }

        $this->assertSame($small, $this->countQueries(fn () => $this->get('/api/admin/newsletter/export')->streamedContent()));
    }
}
