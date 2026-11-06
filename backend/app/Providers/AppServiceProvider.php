<?php

namespace App\Providers;

use App\Support\PasswordAttempts;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $tooManyAttempts = fn (Request $request, array $headers) => PasswordAttempts::tooManyResponse($headers);

        RateLimiter::for('login', function (Request $request) use ($tooManyAttempts) {
            // The limiter runs before validation, so email can still be anything here.
            $email = $request->input('email');

            return Limit::perMinute(5)
                ->by(Str::lower(is_string($email) ? $email : '') . '|' . $request->ip())
                ->response($tooManyAttempts);
        });

        RateLimiter::for('orders', function (Request $request) use ($tooManyAttempts) {
            return Limit::perMinute(20)->by($request->ip())->response($tooManyAttempts);
        });
    }
}
