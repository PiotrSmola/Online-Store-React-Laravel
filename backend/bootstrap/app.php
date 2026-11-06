<?php

use App\Http\Middleware\EnsureAdmin;
use App\Support\SafeExceptionContext;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Behind the nginx container every shopper would otherwise have the proxy's IP
        // and share one rate limit. Which proxies are trusted is in config/trustedproxy.php.
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR);

        $middleware->alias(['admin' => EnsureAdmin::class]);

        // Before route bindings, so a customer gets a 403 for ids that exist and ids that do not.
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: EnsureAdmin::class);

        $middleware->web(append: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->api(append: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        // A failed query's message quotes its bindings: emails, hashes, addresses.
        $exceptions->report(function (QueryException $e) {
            Log::error('Database query failed', SafeExceptionContext::of($e));

            return false;
        });

        // The default messages are in English and a 404 names the model and the id.
        $exceptions->render(fn (AuthenticationException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => 'Nie zalogowano'], 401)
            : null);

        $exceptions->render(fn (NotFoundHttpException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => 'Nie znaleziono'], 404)
            : null);

        $exceptions->render(fn (MethodNotAllowedHttpException $e, Request $request) => $request->is('api/*')
            ? response()->json(['message' => 'Niedozwolona metoda'], 405)
            : null);

        $exceptions->render(function (\Throwable $e, Request $request) {
            $handledElsewhere = $e instanceof HttpExceptionInterface
                || $e instanceof ValidationException
                || $e instanceof AuthenticationException
                || $e instanceof HttpResponseException;

            if ($handledElsewhere || !$request->is('api/*') || config('app.debug')) {
                return null;
            }

            return response()->json(['message' => 'Wystąpił błąd serwera. Spróbuj ponownie później.'], 500);
        });
    })->create();
