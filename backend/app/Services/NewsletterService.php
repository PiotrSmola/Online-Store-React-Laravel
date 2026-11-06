<?php

namespace App\Services;

use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use App\Support\QueuedMail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class NewsletterService
{
    /** A repeated request inside this window sends nothing: the form must not be a way to flood someone's inbox. */
    private const RESEND_AFTER_MINUTES = 10;

    private const TOKEN_LENGTH = 64;

    /** How long a confirmation link works. Unconfirmed addresses are deleted after this too. */
    private const CONFIRM_WITHIN_DAYS = 7;

    /** Returns nothing on purpose: the caller's reply cannot depend on what happened here. */
    public function subscribe(string $email): void
    {
        $email = Str::lower(trim($email));
        $subscriber = $this->findOrCreate($email);

        if ($subscriber->confirmed_at !== null) {
            return;
        }

        if (!$subscriber->wasRecentlyCreated) {
            if ($subscriber->created_at->gt(now()->subMinutes(self::RESEND_AFTER_MINUTES))) {
                return;
            }

            // A new request starts over: new links, and a full window to use them.
            $subscriber->delete();
            $subscriber = $this->findOrCreate($email);
        }

        // To the stored address: on MySQL the lookup also matches spellings it treats as equal.
        QueuedMail::send($subscriber->email, new NewsletterConfirmation(
            $this->link('confirm', $subscriber->confirm_token),
            $this->link('unsubscribe', $subscriber->unsubscribe_token)
        ), ['subscriber_id' => $subscriber->id]);
    }

    public function confirm(string $token): void
    {
        $subscriber = NewsletterSubscriber::where('confirm_token', $token)
            ->where('created_at', '>=', now()->subDays(self::CONFIRM_WITHIN_DAYS))
            ->first();

        if (!$subscriber) {
            throw ValidationException::withMessages(['token' => ['Link potwierdzający jest nieprawidłowy lub został już użyty.']]);
        }

        $subscriber->forceFill(['confirmed_at' => now(), 'confirm_token' => null])->save();
    }

    /** Removes the row: after unsubscribing the shop keeps nothing about the address. */
    public function unsubscribe(string $token): void
    {
        $deleted = NewsletterSubscriber::where('unsubscribe_token', $token)->delete();

        if (!$deleted) {
            throw ValidationException::withMessages(['token' => ['Link wypisania jest nieprawidłowy lub został już użyty.']]);
        }
    }

    /** An address nobody confirmed must not stay stored: no consent was given for it. */
    public function pruneUnconfirmed(): int
    {
        return NewsletterSubscriber::query()
            ->whereNull('confirmed_at')
            ->where('created_at', '<', now()->subDays(self::CONFIRM_WITHIN_DAYS))
            ->delete();
    }

    private function findOrCreate(string $email): NewsletterSubscriber
    {
        return NewsletterSubscriber::createOrFirst(
            ['email' => $email],
            ['confirm_token' => Str::random(self::TOKEN_LENGTH), 'unsubscribe_token' => Str::random(self::TOKEN_LENGTH)]
        );
    }

    private function link(string $action, string $token): string
    {
        return rtrim(config('app.url'), '/') . "/newsletter/{$action}?token=" . urlencode($token);
    }
}
