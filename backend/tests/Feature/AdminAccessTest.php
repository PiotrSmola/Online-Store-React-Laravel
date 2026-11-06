<?php

namespace Tests\Feature;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, RefreshDatabase;

    /** @return list<array{string, string}> Every /api/admin route, read from the router. */
    private function adminRoutes(): array
    {
        $routes = [];

        foreach (Route::getRoutes() as $route) {
            /** @var RoutingRoute $route */
            if (str_starts_with($route->uri(), 'api/admin')) {
                foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                    $routes[] = [$method, $route->uri()];
                }
            }
        }

        return $routes;
    }

    private function callWithMissingIds(string $method, string $uri)
    {
        return $this->json($method, preg_replace('/\{[a-z]+\}/', '999999', '/' . $uri));
    }

    public function test_the_list_of_admin_routes_is_complete(): void
    {
        $this->assertCount(25, $this->adminRoutes());
    }

    public function test_every_admin_route_carries_both_middlewares(): void
    {
        foreach (Route::getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/admin')) {
                $this->assertContains('auth:sanctum', $route->gatherMiddleware(), $route->uri());
                $this->assertContains('admin', $route->gatherMiddleware(), $route->uri());
            }
        }
    }

    public function test_guests_get_401_on_every_admin_route(): void
    {
        foreach ($this->adminRoutes() as [$method, $uri]) {
            $this->callWithMissingIds($method, $uri)->assertUnauthorized();
        }
    }

    public function test_normal_customers_get_403_on_every_admin_route(): void
    {
        $this->actingAs($this->createCustomer(), 'sanctum');

        foreach ($this->adminRoutes() as [$method, $uri]) {
            $this->callWithMissingIds($method, $uri)->assertForbidden()->assertExactJson(['message' => 'Brak dostępu']);
        }
    }

    public function test_a_real_customer_token_is_refused_too(): void
    {
        $token = $this->createCustomer()->createToken('customer-token')->plainTextToken;

        $this->withToken($token)->getJson('/api/admin/stats')->assertForbidden();
    }

    public function test_admins_get_past_the_middleware(): void
    {
        $this->actingAs($this->createAdmin(), 'sanctum');

        foreach ($this->adminRoutes() as [$method, $uri]) {
            $status = $this->callWithMissingIds($method, $uri)->getStatusCode();

            $this->assertNotContains($status, [401, 403, 500], "{$method} {$uri}");
        }
    }

    public function test_request_body_cannot_claim_admin(): void
    {
        $token = $this->createCustomer()->createToken('customer-token')->plainTextToken;

        $this->withToken($token)->postJson('/api/admin/coupons', ['is_admin' => true, 'code' => 'X'])->assertForbidden();
    }

    public function test_admin_login_attempts_are_limited(): void
    {
        $admin = $this->createAdmin();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/customer/login', ['email' => $admin->email, 'password' => "wrong-{$i}"])->assertStatus(422);
        }

        $this->postJson('/api/customer/login', ['email' => $admin->email, 'password' => $this->customerPassword])
            ->assertStatus(429);
        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_is_admin_stays_false_for_ordinary_accounts(): void
    {
        $this->assertFalse(Customer::query()->find($this->createCustomer()->id)->is_admin);
    }
}
