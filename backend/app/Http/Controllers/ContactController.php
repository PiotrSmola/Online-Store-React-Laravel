<?php

namespace App\Http\Controllers;

use App\Services\ContactService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    /** Stays empty for people: the frontend hides it. */
    private const HONEYPOT = 'website';

    private const NO_CONTROL_CHARACTERS = 'not_regex:/[\x00-\x1F\x7F]/';

    public function store(Request $request, ContactService $contact)
    {
        // Answered like a success, so a bot has no signal that it was caught.
        if (filled($request->input(self::HONEYPOT))) {
            return $this->sent();
        }

        $contact->receive($request->validate([
            'name' => ['required', 'string', 'max:100', self::NO_CONTROL_CHARACTERS],
            'email' => 'required|email|max:255',
            'subject' => ['required', 'string', 'max:150', self::NO_CONTROL_CHARACTERS],
            'message' => 'required|string|max:5000',
        ]));

        return $this->sent();
    }

    private function sent(): JsonResponse
    {
        return response()->json(['message' => 'Dziękujemy za wiadomość. Odpowiemy najszybciej, jak to możliwe.']);
    }
}
