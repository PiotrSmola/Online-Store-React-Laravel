<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderOptionsValidationTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function orderWithOptions(Product $product, mixed $size, mixed $color): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($product, [
            'cart_items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'selected_size' => $size,
                'selected_color' => $color,
            ]],
        ]));
    }

    private function assertRejected(TestResponse $response, string $field): void
    {
        $response->assertStatus(422)->assertJsonValidationErrors(["cart_items.0.{$field}"]);
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_offered_options_are_accepted_and_stored(): void
    {
        $response = $this->orderWithOptions($this->createProduct(), 'S', 'Pudrowy róż');

        $response->assertOk();
        $item = OrderItem::sole();
        $this->assertSame('S', $item->selected_size);
        $this->assertSame('Pudrowy róż', $item->selected_color);
    }

    public function test_size_the_product_does_not_offer_is_rejected(): void
    {
        $this->assertRejected($this->orderWithOptions($this->createProduct(), 'XXXL', 'Czarny'), 'selected_size');
    }

    public function test_color_the_product_does_not_offer_is_rejected(): void
    {
        $this->assertRejected($this->orderWithOptions($this->createProduct(), 'M', 'Różowy'), 'selected_color');
    }

    public function test_option_match_is_case_sensitive(): void
    {
        $this->assertRejected($this->orderWithOptions($this->createProduct(), 'm', 'Czarny'), 'selected_size');
    }

    public function test_size_on_a_product_with_an_empty_size_list_is_rejected(): void
    {
        $product = $this->createProduct(['rozmiar' => []]);

        $this->assertRejected($this->orderWithOptions($product, 'M', 'Czarny'), 'selected_size');
    }

    public function test_color_on_a_product_with_null_colors_is_rejected(): void
    {
        $product = $this->createProduct(['kolor' => null]);

        $this->assertRejected($this->orderWithOptions($product, 'M', 'Czarny'), 'selected_color');
    }

    public function test_product_with_sizes_needs_a_size(): void
    {
        $this->assertRejected($this->orderWithOptions($this->createProduct(), null, 'Czarny'), 'selected_size');
    }

    public function test_product_with_colors_needs_a_color(): void
    {
        $this->assertRejected($this->orderWithOptions($this->createProduct(), 'M', null), 'selected_color');
    }

    public function test_missing_option_keys_count_as_not_chosen(): void
    {
        $product = $this->createProduct();

        $response = $this->postJson('/api/orders', $this->orderPayload($product, [
            'cart_items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors([
            'cart_items.0.selected_size',
            'cart_items.0.selected_color',
        ]);
    }

    public function test_empty_strings_from_product_detail_are_accepted_when_there_are_no_options(): void
    {
        $product = $this->createProduct(['rozmiar' => [], 'kolor' => []]);

        $this->orderWithOptions($product, '', '')->assertOk();

        $this->assertNull(OrderItem::sole()->selected_size);
        $this->assertNull(OrderItem::sole()->selected_color);
    }

    public function test_null_options_are_accepted_when_the_product_columns_are_null(): void
    {
        $product = $this->createProduct(['rozmiar' => null, 'kolor' => null]);

        $this->orderWithOptions($product, null, null)->assertOk();

        $this->assertDatabaseCount('orders', 1);
    }

    public function test_product_with_colors_only_takes_a_null_size(): void
    {
        $product = $this->createProduct(['rozmiar' => []]);

        $this->orderWithOptions($product, '', 'Czarny')->assertOk();

        $this->assertNull(OrderItem::sole()->selected_size);
        $this->assertSame('Czarny', OrderItem::sole()->selected_color);
    }

    public function test_stored_options_are_trimmed_before_comparing(): void
    {
        $product = $this->createProduct(['rozmiar' => [' S ', 'M '], 'kolor' => ["Czarny\n"]]);

        // ProductDetail sends the stored value as it is; the request pipeline trims it.
        $this->orderWithOptions($product, ' S ', "Czarny\n")->assertOk();

        $this->assertSame('S', OrderItem::sole()->selected_size);
        $this->assertSame('Czarny', OrderItem::sole()->selected_color);
    }

    public function test_stored_blank_options_count_as_no_options(): void
    {
        $product = $this->createProduct(['rozmiar' => ['', '   '], 'kolor' => [null, ' ']]);

        $this->orderWithOptions($product, null, null)->assertOk();

        $this->assertDatabaseCount('orders', 1);
    }

    public function test_value_on_a_product_with_only_blank_options_is_rejected(): void
    {
        $product = $this->createProduct(['rozmiar' => ['', '   ']]);

        $this->assertRejected($this->orderWithOptions($product, 'M', 'Czarny'), 'selected_size');
    }

    public function test_error_names_the_offending_cart_line(): void
    {
        $valid = $this->createProduct();
        $invalid = $this->createProduct(['nazwa' => 'Pasek', 'rozmiar' => ['90']]);

        $response = $this->postJson('/api/orders', $this->orderPayload($valid, [
            'cart_items' => [
                ['product_id' => $valid->id, 'quantity' => 1, 'selected_size' => 'M', 'selected_color' => 'Czarny'],
                ['product_id' => $invalid->id, 'quantity' => 1, 'selected_size' => '100', 'selected_color' => 'Czarny'],
            ],
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['cart_items.1.selected_size']);
        $this->assertStringContainsString('Pasek', $response->json('errors')['cart_items.1.selected_size'][0]);
        $this->assertSame(0, Order::count());
    }

    public function test_non_scalar_product_id_gets_a_validation_error(): void
    {
        $product = $this->createProduct();

        $response = $this->postJson('/api/orders', $this->orderPayload($product, [
            'cart_items' => [['product_id' => [$product->id], 'quantity' => 1]],
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['cart_items.0.product_id']);
    }
}
