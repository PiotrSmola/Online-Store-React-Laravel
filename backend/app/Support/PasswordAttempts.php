<?php

namespace App\Support;

use App\Models\Customer;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class PasswordAttempts
{
    private const MAX_FAILURES = 5;

    private const DECAY_SECONDS = 60;

    /**
     * Checks the request's password against a customer the caller has already looked up.
     *
     * The email limiters key on the text of the address, but the database collation matches
     * several spellings (víctim@, victim@) to one account. This budget keys on the account.
     *
     * @throws HttpResponseException with a 429 once the budget is used, before any hash check
     */
    public static function verify(Request $request, Customer $customer): bool
    {
        $key = 'customer-password:' . $customer->id . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($key, self::MAX_FAILURES)) {
            throw new HttpResponseException(self::tooManyResponse([
                'Retry-After' => RateLimiter::availableIn($key),
            ]));
        }

        // Counted before the slow hash, so parallel requests cannot all pass the check above.
        RateLimiter::hit($key, self::DECAY_SECONDS);

        if (Hash::check($request->password, $customer->password)) {
            RateLimiter::decrement($key, self::DECAY_SECONDS);

            return true;
        }

        return false;
    }

    public static function tooManyResponse(array $headers = []): JsonResponse
    {
        return response()->json([
            'message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
        ], 429, $headers);
    }
}
