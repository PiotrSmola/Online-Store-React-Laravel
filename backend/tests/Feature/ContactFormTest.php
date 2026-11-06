<?php

namespace Tests\Feature;

use App\Mail\ContactMessageReceived;
use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class ContactFormTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, CountsQueries, RefreshDatabase;

    private function send(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/contact', array_merge([
            'name' => 'Ewa Nowak',
            'email' => 'ewa@example.com',
            'subject' => 'Pytanie o rozmiar',
            'message' => 'Czy ta kurtka jest dostępna w rozmiarze M?',
        ], $overrides));
    }

    private function storedMessage(array $overrides = []): ContactMessage
    {
        return ContactMessage::create(array_merge([
            'name' => 'Ewa Nowak',
            'email' => 'ewa@example.com',
            'subject' => 'Pytanie',
            'message' => 'Treść',
        ], $overrides));
    }

    public function test_a_message_is_stored_and_queued_to_the_shop_with_reply_to_the_sender(): void
    {
        Mail::fake();
        config(['shop.contact.email' => 'obsluga@sklep.example']);

        $this->send()->assertOk()->assertJsonStructure(['message']);

        $message = ContactMessage::sole();
        $this->assertSame('Pytanie o rozmiar', $message->subject);
        $this->assertNull($message->read_at);

        Mail::assertQueued(ContactMessageReceived::class, fn (ContactMessageReceived $mail) => $mail->hasTo('obsluga@sklep.example')
            && !$mail->hasTo('ewa@example.com'));
    }

    public function test_reply_to_and_subject_carry_the_sender(): void
    {
        $envelope = (new ContactMessageReceived($this->storedMessage()))->envelope();

        $this->assertSame('ewa@example.com', $envelope->replyTo[0]->address);
        $this->assertSame('Ewa Nowak', $envelope->replyTo[0]->name);
        $this->assertSame('Wiadomość ze strony: Pytanie', $envelope->subject);
        $this->assertSame([], $envelope->from ?? [], 'From stays the shop\'s own address.');
    }

    public static function headerInjections(): array
    {
        return [
            'name with a new line' => ['name', "Ewa\r\nBcc: ofiara@example.com"],
            'name with a bare line feed' => ['name', "Ewa\nBcc: ofiara@example.com"],
            'subject with a new line' => ['subject', "Pytanie\r\nBcc: ofiara@example.com"],
            'subject with a null byte' => ['subject', "Pytanie\0Bcc"],
            'email with a new line' => ['email', "ewa@example.com\r\nBcc: ofiara@example.com"],
        ];
    }

    #[DataProvider('headerInjections')]
    public function test_header_injection_is_refused(string $field, string $value): void
    {
        Mail::fake();

        $this->send([$field => $value])->assertStatus(422)->assertJsonValidationErrors([$field]);

        $this->assertDatabaseCount('contact_messages', 0);
        Mail::assertNothingOutgoing();
    }

    public function test_the_mail_strips_control_characters_even_from_a_stored_row(): void
    {
        $envelope = (new ContactMessageReceived($this->storedMessage([
            'name' => "Ewa\r\nBcc: ofiara@example.com",
            'subject' => "Pytanie\r\nBcc: ofiara@example.com",
        ])))->envelope();

        $this->assertStringNotContainsString("\n", $envelope->subject);
        $this->assertStringNotContainsString("\r", $envelope->subject);
        $this->assertStringNotContainsString("\n", $envelope->replyTo[0]->name);
    }

    public function test_line_breaks_stay_allowed_in_the_message_body(): void
    {
        Mail::fake();

        $this->send(['message' => "Dzień dobry,\nmam pytanie."])->assertOk();

        $this->assertStringContainsString("\n", ContactMessage::sole()->message);
    }

    public static function invalidMessages(): array
    {
        return [
            'no name' => [['name' => ''], 'name'],
            'name too long' => [['name' => str_repeat('a', 101)], 'name'],
            'no email' => [['email' => ''], 'email'],
            'bad email' => [['email' => 'nie-adres'], 'email'],
            'no subject' => [['subject' => ''], 'subject'],
            'subject too long' => [['subject' => str_repeat('a', 151)], 'subject'],
            'no message' => [['message' => ''], 'message'],
            'message too long' => [['message' => str_repeat('a', 5001)], 'message'],
            'message is a list' => [['message' => ['a']], 'message'],
        ];
    }

    #[DataProvider('invalidMessages')]
    public function test_invalid_input_is_refused(array $overrides, string $field): void
    {
        Mail::fake();

        $this->send($overrides)->assertStatus(422)->assertJsonValidationErrors([$field]);

        $this->assertDatabaseCount('contact_messages', 0);
    }

    public function test_longest_allowed_values_are_accepted(): void
    {
        Mail::fake();

        $this->send([
            'name' => str_repeat('a', 100),
            'subject' => str_repeat('a', 150),
            'message' => str_repeat('a', 5000),
        ])->assertOk();
    }

    public function test_the_honeypot_looks_like_success_and_does_nothing(): void
    {
        Mail::fake();

        $normal = $this->send()->assertOk()->json();
        $caught = $this->send(['website' => 'http://spam.example'])->assertOk()->json();

        $this->assertSame($normal, $caught);
        $this->assertDatabaseCount('contact_messages', 1);
        Mail::assertQueued(ContactMessageReceived::class, 1);
    }

    public function test_the_honeypot_answers_before_validation_can_give_it_away(): void
    {
        Mail::fake();

        $this->postJson('/api/contact', ['website' => 'x'])->assertOk();

        $this->assertDatabaseCount('contact_messages', 0);
    }

    public function test_a_read_flag_in_the_body_is_ignored(): void
    {
        Mail::fake();

        $this->send(['read_at' => now()->toDateTimeString()])->assertOk();

        $this->assertNull(ContactMessage::sole()->read_at);
    }

    public function test_a_mail_failure_keeps_the_message_and_the_reply(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down'));

        $this->send()->assertOk();

        $this->assertDatabaseCount('contact_messages', 1);
    }

    public function test_the_form_is_rate_limited(): void
    {
        Mail::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->send()->assertOk();
        }

        $this->send()->assertStatus(429)->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);
    }

    public function test_the_honeypot_spends_the_rate_limit_too(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->send(['website' => 'x'])->assertOk();
        }

        $this->send(['website' => 'x'])->assertStatus(429);
    }

    public function test_the_mail_escapes_what_the_visitor_wrote(): void
    {
        $html = (new ContactMessageReceived($this->storedMessage([
            'name' => '<b>Ewa</b>',
            'subject' => '<img src=x onerror=alert(1)>',
            'message' => '<script>alert(1)</script>',
        ])))->render();

        $this->assertStringNotContainsString('<script>alert', $html);
        $this->assertStringNotContainsString('<img src=x', $html);
        $this->assertStringNotContainsString('<b>Ewa', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    public function test_the_mail_shows_the_message_text(): void
    {
        $html = (new ContactMessageReceived($this->storedMessage(['message' => 'Treść pytania o kurtkę'])))->render();

        $this->assertStringContainsString('Treść pytania o kurtkę', $html);
        $this->assertStringContainsString('ewa@example.com', $html);
    }

    public function test_a_queued_mail_survives_the_message_being_deleted_first(): void
    {
        $message = $this->storedMessage();
        $queued = unserialize(serialize(new ContactMessageReceived($message)));
        $message->delete();

        $this->assertStringContainsString('Treść', $queued->render());
    }

    public function test_nothing_the_visitor_wrote_is_logged(): void
    {
        Mail::fake();
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged) {
            $logged[] = $event;
        });

        $this->send()->assertOk();

        $this->assertSame([], $logged);
    }

    // Admin

    public function test_admin_list_is_paginated_newest_first_with_an_unread_filter(): void
    {
        $this->storedMessage(['subject' => 'Starsza']);
        $read = $this->storedMessage(['subject' => 'Przeczytana']);
        $read->read_at = now();
        $read->save();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $this->getJson('/api/admin/messages')->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('per_page', 20)
            ->assertJsonPath('data.0.subject', 'Przeczytana')
            ->assertJsonPath('data.1.message', 'Treść');

        $this->getJson('/api/admin/messages?unread=1')->assertJsonPath('total', 1)->assertJsonPath('data.0.subject', 'Starsza');
        $this->getJson('/api/admin/messages?unread=0')->assertJsonPath('total', 2);
        $this->getJson('/api/admin/messages?unread=tak')->assertStatus(422);
    }

    public function test_marking_read_keeps_the_first_moment(): void
    {
        $message = $this->storedMessage();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $first = $this->patchJson("/api/admin/messages/{$message->id}/read")->assertOk()->json('read_at');
        $this->assertNotNull($first);

        $this->travel(1)->hour();

        $this->patchJson("/api/admin/messages/{$message->id}/read")->assertOk()->assertJsonPath('read_at', $first);
    }

    public function test_admin_can_delete_a_message(): void
    {
        $message = $this->storedMessage();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $this->deleteJson("/api/admin/messages/{$message->id}")->assertOk();

        $this->assertDatabaseCount('contact_messages', 0);
    }

    public function test_the_list_query_count_does_not_grow(): void
    {
        $this->actingAs($this->createAdmin(), 'sanctum');
        $this->storedMessage();
        $one = $this->countQueries(fn () => $this->getJson('/api/admin/messages')->assertOk());

        for ($i = 0; $i < 10; $i++) {
            $this->storedMessage();
        }

        $this->assertSame($one, $this->countQueries(fn () => $this->getJson('/api/admin/messages')->assertOk()));
    }

    public function test_guests_cannot_read_messages_through_any_public_route(): void
    {
        $this->storedMessage();

        $this->getJson('/api/contact')->assertStatus(405);
    }

    // Shop contact details

    public function test_config_returns_the_shop_contact_details(): void
    {
        $this->getJson('/api/config')->assertOk()
            ->assertJsonStructure(['contact' => ['email', 'phone', 'address', 'opening_hours']]);
    }

    public function test_contact_details_come_from_the_environment_with_fictional_defaults(): void
    {
        $defaults = (require base_path('config/shop.php'))['contact'];

        $this->assertStringEndsWith('.example', $defaults['email']);

        $_ENV['SHOP_CONTACT_PHONE'] = $_SERVER['SHOP_CONTACT_PHONE'] = '+48 111 111 111';

        try {
            $this->assertSame('+48 111 111 111', (require base_path('config/shop.php'))['contact']['phone']);
        } finally {
            unset($_ENV['SHOP_CONTACT_PHONE'], $_SERVER['SHOP_CONTACT_PHONE']);
        }
    }
}
