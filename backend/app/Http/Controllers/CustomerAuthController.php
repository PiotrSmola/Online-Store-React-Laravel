<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    public function login(Request $request)
    {
        Log::info('Customer login attempt:', $request->only(['email']));

        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $customer = Customer::where('email', $request->email)->first();

        Log::info('Customer found:', ['exists' => !!$customer]);

        if (!$customer || !Hash::check($request->password, $customer->password)) {
            Log::warning('Login failed for email:', ['email' => $request->email]);

            return response()->json([
                'message' => 'Podane dane logowania są nieprawidłowe.',
                'errors' => [
                    'email' => ['Podane dane logowania są nieprawidłowe.']
                ]
            ], 422);
        }

        $token = $customer->createToken('customer-token')->plainTextToken;

        Log::info('Customer login successful:', ['customer_id' => $customer->id]);

        return response()->json([
            'customer' => $customer,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        Log::info('Customer logout:', ['customer_id' => $request->user('sanctum')->id ?? 'unknown']);

        $request->user('sanctum')->tokens()->delete();

        return response()->json([
            'message' => 'Wylogowano pomyślnie.'
        ]);
    }

    public function me(Request $request)
    {
        $customer = $request->user('sanctum');

        Log::info('Customer me request:', ['customer_id' => $customer->id ?? 'not authenticated']);

        if (!$customer) {
            return response()->json([
                'message' => 'Nie zalogowano'
            ], 401);
        }

        return response()->json($customer);
    }
}
