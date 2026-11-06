<?php

namespace Tests\Feature;

use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderDeliveryPriceTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    public static function deliveryMethods(): array
    {
        return [
            'courier' => ['courier', '15.99', '216.99'],
            'pickup point' => ['pickup_point', '12.99', '213.99'],
            'store pickup' => ['store_pickup', '0.00', '201.00'],
        ];
    }

    private function twoItemCart(int $productId): array
    {
        return [['product_id' => $productId, 'quantity' => 2, 'selected_size' => 'M', 'selected_color' => 'Czarny']];
    }

    #[DataProvider('deliveryMethods')]
    public function test_delivery_price_comes_from_the_server(string $method, string $price, string $total): void
    {
        $product = $this->createProduct();

        $response = $this->postJson('/api/orders', $this->orderPayload($product, [
            'delivery_method' => $method,
            'pickup_point' => 'WAW01M',
            'delivery_price' => 0.01,
            'total_with_delivery' => 0.01,
            'cart_items' => $this->twoItemCart($product->id),
        ]));

        $response->assertOk();
        $order = Order::sole();
        $this->assertSame($price, $order->delivery_price);
        $this->assertSame($total, $order->total_amount);
    }

    #[DataProvider('deliveryMethods')]
    public function test_client_price_fields_are_not_required(string $method, string $price, string $total): void
    {
        $product = $this->createProduct();
        $payload = $this->orderPayload($product, [
            'delivery_method' => $method,
            'pickup_point' => 'WAW01M',
            'cart_items' => $this->twoItemCart($product->id),
        ]);
        unset($payload['delivery_price'], $payload['total_with_delivery']);

        $this->postJson('/api/orders', $payload)->assertOk();

        $this->assertSame($price, Order::sole()->delivery_price);
        $this->assertSame($total, Order::sole()->total_amount);
    }

    public function test_malformed_client_price_fields_are_ignored(): void
    {
        $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'delivery_price' => 'free',
            'total_with_delivery' => -5,
        ]))->assertOk();

        $this->assertSame('15.99', Order::sole()->delivery_price);
        $this->assertSame('116.49', Order::sole()->total_amount);
    }

    public function test_unknown_delivery_method_is_rejected(): void
    {
        $response = $this->postJson('/api/orders', $this->orderPayload($this->createProduct(), [
            'delivery_method' => 'drone',
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['delivery_method']);
        $this->assertDatabaseCount('orders', 0);
    }
}
