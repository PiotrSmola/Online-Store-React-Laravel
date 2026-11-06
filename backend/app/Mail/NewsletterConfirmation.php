<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class NewsletterConfirmation extends Mailable implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $confirmUrl, public string $unsubscribeUrl)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Potwierdź zapis do newslettera');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.newsletter-confirmation');
    }
}
