<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class CustomerAuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $customer = Customer::where('email', $request->email)->first();

        if (!$customer || !Hash::check($request->password, $customer->password)) {
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
}
