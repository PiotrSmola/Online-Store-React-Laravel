<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\ProductImage;
use App\Models\Review;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
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

    /**
     * What each route answers an admin who sends no body. A 422 names the field that proves the
     * controller's own validation ran; a 200 names a key only that route returns. The list
     * runs in order against one set of records, so a route added without an entry fails here.
     *
     * @return array<string, array{int, string}>
     */
    private function adminExpectations(): array
    {
        return [
            'GET api/admin/stats' => [200, 'orders_by_status'],
            'GET api/admin/products' => [200, 'data'],
            'POST api/admin/products' => [422, 'nazwa'],
            'GET api/admin/products/{product}' => [200, 'variants'],
            'PUT api/admin/products/{product}' => [200, 'variants'],
            'POST api/admin/products/{product}/images' => [422, 'image'],
            'DELETE api/admin/products/{product}/images/{image}' => [200, 'message'],
            'GET api/admin/orders' => [200, 'data'],
            'GET api/admin/orders/{order}' => [200, 'status_events'],
            'PATCH api/admin/orders/{order}/status' => [422, 'status'],
            'PATCH api/admin/orders/{order}/payment' => [200, 'paid_at'],
            'GET api/admin/orders/{order}/invoice' => [200, 'application/pdf'],
            'GET api/admin/customers' => [200, 'data'],
            'GET api/admin/coupons' => [200, 'data'],
            'POST api/admin/coupons' => [422, 'code'],
            'GET api/admin/coupons/{coupon}' => [200, 'used_count'],
            'PUT api/admin/coupons/{coupon}' => [200, 'used_count'],
            'DELETE api/admin/coupons/{coupon}' => [200, 'message'],
            'DELETE api/admin/reviews/{review}' => [200, 'message'],
            'GET api/admin/messages' => [200, 'data'],
            'PATCH api/admin/messages/{message}/read' => [200, 'read_at'],
            'DELETE api/admin/messages/{message}' => [200, 'message'],
            'GET api/admin/newsletter' => [200, 'data'],
            'GET api/admin/newsletter/export' => [200, 'text/csv'],
            'DELETE api/admin/products/{product}' => [200, 'deleted'],
        ];
    }

    public function test_every_admin_route_is_listed_with_what_it_answers(): void
    {
        $this->assertEqualsCanonicalizing(
            array_map(fn (array $route) => "{$route[0]} {$route[1]}", $this->adminRoutes()),
            array_keys($this->adminExpectations())
        );
    }

    public function test_admins_reach_each_controller_and_get_its_real_answer(): void
    {
        Storage::fake('public');
        $product = $this->createProduct();
        $customer = $this->createCustomer();

        $ids = [
            '{product}' => $product->id,
            '{image}' => ProductImage::create(['product_id' => $product->id, 'image_path' => 'a.jpg', 'order' => 0])->id,
            '{coupon}' => Coupon::create(['code' => 'TEST', 'type' => 'percent', 'value' => 10])->id,
            '{review}' => Review::create(['product_id' => $product->id, 'customer_id' => $customer->id, 'rating' => 5])->id,
            '{message}' => ContactMessage::create(['name' => 'A', 'email' => 'a@example.com', 'subject' => 'S', 'message' => 'M'])->id,
            '{order}' => app(OrderService::class)->place($customer, [
                'items' => [['product_id' => $product->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
                'payment_method' => 'transfer',
                'delivery_method' => 'courier',
                'billing_address' => [],
                'shipping_address' => [],
                'payment_details' => ['method' => 'transfer'],
            ])->id,
        ];

        $this->actingAs($this->createAdmin(), 'sanctum');

        foreach ($this->adminExpectations() as $route => [$status, $proof]) {
            [$method, $uri] = explode(' ', $route);
            $response = $this->json($method, '/' . strtr($uri, $ids));

            $this->assertSame($status, $response->getStatusCode(), $route);

            if ($status === 422) {
                $response->assertJsonValidationErrors([$proof]);
            } elseif (str_contains($proof, '/')) {
                $this->assertStringStartsWith($proof, $response->headers->get('Content-Type'), $route);
            } else {
                $this->assertArrayHasKey($proof, $response->json(), $route);
            }
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
