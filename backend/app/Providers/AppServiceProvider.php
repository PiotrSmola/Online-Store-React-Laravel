<?php

namespace App\Providers;

use App\Models\Customer;
use App\Support\PasswordAttempts;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

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
        Password::defaults(fn () => Password::min(8));

        ResetPassword::createUrlUsing(fn (Customer $customer, string $token) => sprintf(
            '%s/reset-password?token=%s&email=%s',
            rtrim(config('app.url'), '/'),
            urlencode($token),
            urlencode($customer->getEmailForPasswordReset())
        ));

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

        // Each is counted per address: these routes have no account to key on yet.
        foreach (['register' => 5, 'forgot-password' => 5, 'reset-password' => 10] as $name => $perMinute) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($perMinute)
                ->by($request->ip())
                ->response($tooManyAttempts));
        }

        RateLimiter::for('reviews', fn (Request $request) => Limit::perMinute(10)
            ->by((string) $request->user()?->id)
            ->response($tooManyAttempts));

        // The cart asks for a quote on every change. Only requests carrying a coupon can
        // guess codes, so those have their own, tighter budget.
        RateLimiter::for('quote', function (Request $request) use ($tooManyAttempts) {
            return filled($request->input('coupon'))
                ? Limit::perMinute(30)->by('coupon|' . $request->ip())->response($tooManyAttempts)
                : Limit::perMinute(120)->by($request->ip())->response($tooManyAttempts);
        });
    }
}
