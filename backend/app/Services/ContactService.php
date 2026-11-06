<?php

namespace App\Services;

use App\Mail\ContactMessageReceived;
use App\Models\ContactMessage;
use App\Support\QueuedMail;

class ContactService
{
    /** @param  array{name: string, email: string, subject: string, message: string}  $data */
    public function receive(array $data): ContactMessage
    {
        $message = ContactMessage::create($data);

        QueuedMail::send(config('shop.contact.email'), new ContactMessageReceived($message), [
            'contact_message_id' => $message->id,
        ]);

        return $message;
    }
}
