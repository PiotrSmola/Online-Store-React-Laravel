<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderQuantityValidationTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function orderQuantity(Product $product, int $quantity): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($product, [
            'cart_items' => [[
                'product_id' => $product->id,
                'quantity' => $quantity,
                'selected_size' => 'M',
                'selected_color' => 'Czarny',
            ]],
        ]));
    }

    public function test_quantity_of_99_is_accepted(): void
    {
        $this->orderQuantity($this->createProduct(), 99)->assertOk();

        $this->assertSame(99, OrderItem::sole()->quantity);
        $this->assertSame('9949.50', Order::sole()->total_amount);
    }

    public function test_quantity_of_100_is_rejected_in_polish_and_writes_nothing(): void
    {
        $response = $this->orderQuantity($this->createProduct(), 100);

        $response->assertStatus(422);
        $this->assertSame(
            ['Maksymalna ilość jednego produktu to 99'],
            $response->json('errors')['cart_items.0.quantity']
        );
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
    }
}
