<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

// Queued so the reply to forgot-password does not take longer when the account exists.
class CustomerResetPassword extends ResetPassword implements ShouldQueue
{
    use Queueable;

    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Zmiana hasła')
            ->view('emails.password-reset', [
                'url' => $url,
                'minutes' => config('auth.passwords.customers.expire'),
            ]);
    }
}
