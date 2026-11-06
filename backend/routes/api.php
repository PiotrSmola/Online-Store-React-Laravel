<?php

use App\Http\Controllers\Admin\CouponController as AdminCouponController;
use App\Http\Controllers\Admin\CustomerController as AdminCustomerController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\ProductImageController as AdminProductImageController;
use App\Http\Controllers\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Admin\StatsController as AdminStatsController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\ConfigController;
use App\Http\Controllers\CustomerAccountController;
use App\Http\Controllers\CustomerAuthController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WishlistController;
use Illuminate\Support\Facades\Route;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/catalog/filters', [ProductController::class, 'filters']);
Route::get('/categories', [ProductController::class, 'categories']);
Route::get('/config', ConfigController::class);
Route::post('/cart/quote', [CartController::class, 'quote'])->middleware('throttle:quote');

Route::post('/customer/register', [CustomerAuthController::class, 'register'])->middleware('throttle:register');
Route::post('/customer/login', [CustomerAuthController::class, 'login'])->middleware('throttle:login');
Route::post('/customer/forgot-password', [CustomerAuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
Route::post('/customer/reset-password', [CustomerAuthController::class, 'resetPassword'])->middleware('throttle:reset-password');

Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:orders');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/customer/logout', [CustomerAuthController::class, 'logout']);
    Route::get('/customer/me', [CustomerAuthController::class, 'me']);
    Route::put('/customer/profile', [CustomerAccountController::class, 'updateProfile']);
    Route::put('/customer/password', [CustomerAccountController::class, 'updatePassword']);

    Route::get('/cart', [CartController::class, 'show']);
    Route::put('/cart', [CartController::class, 'update']);

    Route::get('/wishlist', [WishlistController::class, 'index']);
    Route::post('/wishlist/{product}', [WishlistController::class, 'store']);
    Route::delete('/wishlist/{product}', [WishlistController::class, 'destroy']);

    Route::post('/products/{product}/reviews', [ReviewController::class, 'store'])->middleware('throttle:reviews');

    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{order}/pay', [OrderController::class, 'pay']);
});

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats', AdminStatsController::class);

    Route::get('/products', [AdminProductController::class, 'index']);
    Route::post('/products', [AdminProductController::class, 'store']);
    Route::get('/products/{product}', [AdminProductController::class, 'show']);
    Route::put('/products/{product}', [AdminProductController::class, 'update']);
    Route::delete('/products/{product}', [AdminProductController::class, 'destroy']);
    Route::post('/products/{product}/images', [AdminProductImageController::class, 'store']);
    Route::delete('/products/{product}/images/{image}', [AdminProductImageController::class, 'destroy'])->scopeBindings();

    Route::get('/orders', [AdminOrderController::class, 'index']);
    Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
    Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);
    Route::patch('/orders/{order}/payment', [AdminOrderController::class, 'markPaid']);

    Route::get('/customers', [AdminCustomerController::class, 'index']);

    Route::get('/coupons', [AdminCouponController::class, 'index']);
    Route::post('/coupons', [AdminCouponController::class, 'store']);
    Route::get('/coupons/{coupon}', [AdminCouponController::class, 'show']);
    Route::put('/coupons/{coupon}', [AdminCouponController::class, 'update']);
    Route::delete('/coupons/{coupon}', [AdminCouponController::class, 'destroy']);

    Route::delete('/reviews/{review}', [AdminReviewController::class, 'destroy']);
});
