<?php

namespace App\Http\Controllers;

use App\Support\PasswordAttempts;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class CustomerAccountController extends Controller
{
    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'sometimes|required|string|max:255',
            'last_name' => 'sometimes|required|string|max:255',
            'phone' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string|max:255',
            'city' => 'sometimes|nullable|string|max:255',
            'postal_code' => 'sometimes|nullable|string|max:10',
            'country' => 'sometimes|required|string|max:255',
            'customer_type' => 'sometimes|required|in:individual,company',
            'company_name' => 'nullable|required_if:customer_type,company|string|max:255',
            'nip' => 'nullable|required_if:customer_type,company|string|max:20',
        ]);

        $customer = $request->user();
        $customer->update($validated);

        return response()->json($customer);
    }

    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $customer = $request->user();

        // Same budget as login: a stolen token must not be a way to guess the password.
        if (!PasswordAttempts::verify($request, $customer, $validated['current_password'])) {
            throw ValidationException::withMessages([
                'current_password' => ['Obecne hasło jest nieprawidłowe.'],
            ]);
        }

        $customer->update(['password' => $validated['password']]);

        // Every other device is signed out; the one making the change stays in.
        $current = $customer->currentAccessToken();
        $customer->tokens()
            ->when($current instanceof PersonalAccessToken, fn ($query) => $query->whereKeyNot($current->getKey()))
            ->delete();

        return response()->json(['message' => 'Hasło zostało zmienione.']);
    }
}
