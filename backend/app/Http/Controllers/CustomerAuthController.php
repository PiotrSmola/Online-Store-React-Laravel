<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Support\PasswordAttempts;
use Illuminate\Contracts\Auth\PasswordBroker;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password as PasswordFacade;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class CustomerAuthController extends Controller
{
    private const ACCOUNT_EXISTS_MESSAGE = 'Konto z tym adresem e-mail już istnieje.';

    public function register(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255|unique:customers,email',
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:10',
            'country' => 'nullable|string|max:255',
            'customer_type' => 'nullable|in:individual,company',
            'company_name' => 'nullable|required_if:customer_type,company|string|max:255',
            'nip' => 'nullable|required_if:customer_type,company|string|max:20',
        ], [
            'email.unique' => self::ACCOUNT_EXISTS_MESSAGE,
        ]);

        try {
            // Nulls dropped so the column defaults for country and customer_type apply.
            $customer = Customer::create(array_filter($validated, fn ($value) => $value !== null));
        } catch (UniqueConstraintViolationException) {
            // Lost a race, or the unique index matched an accent variant the rule did not.
            throw ValidationException::withMessages(['email' => [self::ACCOUNT_EXISTS_MESSAGE]]);
        }

        // Refreshed so the response has every column, also those filled by database defaults.
        return response()->json([
            'customer' => $customer->refresh(),
            'token' => $customer->createToken('customer-token')->plainTextToken,
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $customer = Customer::where('email', $request->email)->first();

        if (!$customer || !PasswordAttempts::verify($request, $customer)) {
            return response()->json([
                'message' => 'Podane dane logowania są nieprawidłowe.',
                'errors' => [
                    'email' => ['Podane dane logowania są nieprawidłowe.']
                ]
            ], 422);
        }

        $token = $customer->createToken('customer-token')->plainTextToken;

        return response()->json([
            'customer' => $customer,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->user('sanctum')->currentAccessToken();

        // A session-authenticated request carries a TransientToken, which has no delete().
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Wylogowano pomyślnie.'
        ]);
    }

    public function me(Request $request)
    {
        $customer = $request->user('sanctum');

        if (!$customer) {
            return response()->json([
                'message' => 'Nie zalogowano'
            ], 401);
        }

        return response()->json($customer);
    }

    /** The reply is the same whether or not the account exists. */
    public function forgotPassword(Request $request)
    {
        $validated = $request->validate(['email' => 'required|email']);

        PasswordFacade::broker('customers')->sendResetLink(['email' => $validated['email']]);

        return response()->json([
            'message' => 'Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do zmiany hasła.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $status = PasswordFacade::broker('customers')->reset($validated, function (Customer $customer, string $password) {
            $customer->update(['password' => $password]);
            $customer->tokens()->delete();
        });

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => ['Link do zmiany hasła jest nieprawidłowy lub wygasł.'],
            ]);
        }

        return response()->json(['message' => 'Hasło zostało zmienione. Możesz się zalogować.']);
    }
}
