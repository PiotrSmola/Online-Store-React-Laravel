<?php

namespace App\Support;

use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class QueuedMail
{
    /**
     * Queues a mail without letting a mail problem fail the request around it: by then
     * the order or message is saved, and the visitor must not be told otherwise.
     *
     * @param  array<string, int|string>  $context  Ids only: this ends up in the log.
     */
    public static function send(string $address, Mailable $mail, array $context = []): void
    {
        try {
            Mail::to($address)->queue($mail);
        } catch (\Throwable $e) {
            Log::error('Email could not be queued', $context + SafeExceptionContext::of($e));
        }
    }
}
