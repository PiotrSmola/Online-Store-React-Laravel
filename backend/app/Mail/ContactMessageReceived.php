<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

// Without SerializesModels: an admin may delete the message before the worker gets to it.
class ContactMessageReceived extends Mailable implements ShouldQueue
{
    use Queueable;

    public function __construct(public ContactMessage $contact)
    {
    }

    /**
     * The visitor's text goes into headers, so it is stripped of control characters here
     * too, not only in validation. The sender goes in Reply-To: the From address stays the
     * shop's own, so nobody can send mail that claims to be from an arbitrary address.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [new Address($this->contact->email, self::forHeader($this->contact->name))],
            subject: 'Wiadomość ze strony: ' . self::forHeader($this->contact->subject),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.contact-message');
    }

    private static function forHeader(string $value): string
    {
        return trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value));
    }
}
