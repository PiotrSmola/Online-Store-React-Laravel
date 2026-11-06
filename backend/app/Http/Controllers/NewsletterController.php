<?php

namespace App\Http\Controllers;

use App\Services\NewsletterService;
use Illuminate\Http\Request;

class NewsletterController extends Controller
{
    public function __construct(private NewsletterService $newsletter)
    {
    }

    public function subscribe(Request $request)
    {
        $validated = $request->validate(['email' => 'required|email|max:255']);

        $this->newsletter->subscribe($validated['email']);

        return response()->json([
            'message' => 'Dziękujemy. Jeśli ten adres może zostać zapisany, wysłaliśmy na niego link potwierdzający.',
        ]);
    }

    public function confirm(Request $request)
    {
        $this->newsletter->confirm($this->validatedToken($request));

        return response()->json(['message' => 'Zapis do newslettera został potwierdzony.']);
    }

    public function unsubscribe(Request $request)
    {
        $this->newsletter->unsubscribe($this->validatedToken($request));

        return response()->json(['message' => 'Adres został wypisany z newslettera.']);
    }

    private function validatedToken(Request $request): string
    {
        return $request->validate(['token' => 'required|string|max:64'])['token'];
    }
}
