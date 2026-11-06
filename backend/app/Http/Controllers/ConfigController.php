<?php

namespace App\Http\Controllers;

class ConfigController extends Controller
{
    public function __invoke()
    {
        return response()->json([
            'pickup_points' => config('shop.pickup_points'),
            'bank_account' => config('shop.bank_account'),
            'free_delivery_from' => config('shop.free_delivery_from'),
        ]);
    }
}
