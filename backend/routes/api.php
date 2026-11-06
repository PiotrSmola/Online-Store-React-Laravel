<?php

use App\Http\Controllers\CartController;
use App\Http\Controllers\ConfigController;
use App\Http\Controllers\CustomerAuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/catalog/filters', [ProductController::class, 'filters']);
Route::get('/categories', [ProductController::class, 'categories']);
Route::get('/config', ConfigController::class);
Route::post('/cart/quote', [CartController::class, 'quote'])->middleware('throttle:quote');

Route::post('/customer/login', [CustomerAuthController::class, 'login'])->middleware('throttle:login');

Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:orders');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/customer/logout', [CustomerAuthController::class, 'logout']);
    Route::get('/customer/me', [CustomerAuthController::class, 'me']);

    Route::get('/cart', [CartController::class, 'show']);
    Route::put('/cart', [CartController::class, 'update']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{order}/pay', [OrderController::class, 'pay']);
});
