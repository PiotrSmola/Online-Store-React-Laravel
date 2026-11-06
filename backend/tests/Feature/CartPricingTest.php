<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class CartPricingTest extends TestCase
{
    use BuildsOrders, CountsQueries, RefreshDatabase;

    private function item(Product $product, int $quantity = 1, ?string $size = 'M', ?string $color = 'Czarny'): array
    {
        return ['product_id' => $product->id, 'quantity' => $quantity, 'size' => $size, 'color' => $color];
    }

    private function quote(array $items, array $extra = []): TestResponse
    {
        return $this->postJson('/api/cart/quote', ['items' => $items] + $extra);
    }

    public function test_quote_returns_the_documented_shape(): void
    {
        $product = $this->createProduct();
        ProductImage::create(['product_id' => $product->id, 'image_path' => 'a.jpg', 'order' => 0]);

        $response = $this->quote([$this->item($product, 2)], ['delivery_method' => 'courier']);

        $response->assertOk()->assertJsonStructure([
            'lines' => [['key', 'product' => ['id', 'nazwa', 'images'], 'size', 'color', 'quantity', 'unit_price', 'line_total', 'stock', 'available', 'error']],
            'subtotal', 'discount', 'coupon', 'coupon_error',
            'delivery_options' => [['value', 'label', 'price']],
            'delivery_price', 'free_delivery_from', 'free_delivery_missing', 'total',
        ]);

        $response->assertJsonPath('lines.0.unit_price', 100.5)
            ->assertJsonPath('lines.0.line_total', 201)
            ->assertJsonPath('lines.0.stock', 100)
            ->assertJsonPath('lines.0.available', true)
            ->assertJsonPath('lines.0.error', null)
            ->assertJsonPath('lines.0.product.images.0.image_path', 'a.jpg')
            ->assertJsonPath('subtotal', 201)
            ->assertJsonPath('delivery_price', 15.99)
            ->assertJsonPath('free_delivery_from', 300)
            ->assertJsonPath('free_delivery_missing', 99)
            ->assertJsonPath('total', 216.99);

        $this->assertArrayNotHasKey('opis', $response->json('lines.0.product'));
    }

    public function test_quote_trusts_no_client_price(): void
    {
        $product = $this->createProduct();

        $this->quote([$this->item($product) + ['price' => 0.01, 'unit_price' => 0.01]], ['total' => 0.01])
            ->assertJsonPath('subtotal', 100.5);
    }

    public function test_totals_do_not_pick_up_float_errors(): void
    {
        $product = $this->createProduct(['cena' => 0.07]);

        // In floats 0.07 * 15 is 1.0500000000000003.
        $this->quote([$this->item($product, 15)], ['delivery_method' => 'pickup_point'])
            ->assertJsonPath('subtotal', 1.05)
            ->assertJsonPath('total', 14.04);
    }

    public function test_without_a_chosen_method_the_total_has_no_delivery(): void
    {
        $this->quote([$this->item($this->createProduct())])
            ->assertJsonPath('delivery_price', null)
            ->assertJsonPath('total', 100.5);
    }

    public function test_delivery_options_come_from_config_with_polish_labels(): void
    {
        $this->quote([])->assertOk()->assertJsonPath('delivery_options', [
            ['value' => 'courier', 'label' => 'Kurier', 'price' => 15.99],
            ['value' => 'pickup_point', 'label' => 'Paczkomat', 'price' => 12.99],
            ['value' => 'store_pickup', 'label' => 'Odbiór w sklepie', 'price' => 0],
        ]);
    }

    public function test_delivery_is_free_exactly_from_the_threshold(): void
    {
        $product = $this->createProduct(['cena' => 300]);
        $cheaper = $this->createProduct(['cena' => 299.99]);

        $this->quote([$this->item($product)], ['delivery_method' => 'courier'])
            ->assertJsonPath('delivery_price', 0)
            ->assertJsonPath('free_delivery_missing', 0)
            ->assertJsonPath('delivery_options.0.price', 0)
            ->assertJsonPath('total', 300);

        $this->quote([$this->item($cheaper)], ['delivery_method' => 'courier'])
            ->assertJsonPath('delivery_price', 15.99)
            ->assertJsonPath('free_delivery_missing', 0.01);
    }

    public function test_lines_of_the_same_variant_are_merged_and_checked_together(): void
    {
        $product = $this->createProduct([], 3);

        $this->quote([$this->item($product, 2), $this->item($product, 2)])
            ->assertJsonCount(1, 'lines')
            ->assertJsonPath('lines.0.quantity', 4)
            ->assertJsonPath('lines.0.available', false)
            ->assertJsonPath('subtotal', 0);
    }

    public function test_short_stock_is_reported_and_left_out_of_the_subtotal(): void
    {
        $short = $this->createProduct(['nazwa' => 'Mało'], 2);
        $fine = $this->createProduct(['nazwa' => 'Dużo', 'cena' => 10]);

        $response = $this->quote([$this->item($short, 3), $this->item($fine)]);

        $response->assertJsonPath('lines.0.available', false)
            ->assertJsonPath('lines.0.stock', 2)
            ->assertJsonPath('lines.1.available', true)
            ->assertJsonPath('subtotal', 10);
        $this->assertStringContainsString('2 szt.', $response->json('lines.0.error'));
    }

    public function test_sold_out_variant_is_unavailable(): void
    {
        $response = $this->quote([$this->item($this->createProduct([], 0))]);

        $response->assertJsonPath('lines.0.available', false)->assertJsonPath('lines.0.stock', 0);
        $this->assertStringContainsString('wyprzedany', $response->json('lines.0.error'));
    }

    public function test_combination_without_a_variant_is_unavailable(): void
    {
        $product = $this->createProduct();
        $this->variantOf($product)->delete();

        $response = $this->quote([$this->item($product)]);

        $response->assertJsonPath('lines.0.available', false);
        $this->assertStringContainsString('wariant', $response->json('lines.0.error'));
    }

    public function test_option_the_product_does_not_offer_is_unavailable(): void
    {
        $response = $this->quote([$this->item($this->createProduct(), 1, 'XXXL')]);

        $response->assertJsonPath('lines.0.available', false);
        $this->assertStringContainsString('rozmiar', $response->json('lines.0.error'));
    }

    public function test_missing_option_is_unavailable(): void
    {
        $response = $this->quote([$this->item($this->createProduct(), 1, null)]);

        $response->assertJsonPath('lines.0.available', false);
        $this->assertStringContainsString('Wybierz rozmiar', $response->json('lines.0.error'));
    }

    public function test_product_without_options_has_one_variant(): void
    {
        $product = $this->createProduct(['rozmiar' => [], 'kolor' => null], 5);

        $this->quote([$this->item($product, 1, null, null)])
            ->assertJsonPath('lines.0.available', true)
            ->assertJsonPath('lines.0.stock', 5);
    }

    public function test_inactive_product_is_unavailable(): void
    {
        $this->quote([$this->item($this->createProduct(['is_active' => false]))])
            ->assertOk()
            ->assertJsonPath('lines.0.available', false)
            ->assertJsonPath('subtotal', 0);
    }

    public function test_unknown_coupon_is_reported_but_the_quote_still_works(): void
    {
        $this->quote([$this->item($this->createProduct())], ['coupon' => 'NIEMA'])
            ->assertOk()
            ->assertJsonPath('coupon', null)
            ->assertJsonPath('coupon_error', 'Nieprawidłowy kod rabatowy')
            ->assertJsonPath('subtotal', 100.5);
    }

    public function test_bad_input_is_rejected(): void
    {
        $product = $this->createProduct();

        $this->postJson('/api/cart/quote', [])->assertStatus(422)->assertJsonValidationErrors(['items']);
        $this->quote([$this->item($product, 0)])->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity']);
        $this->quote([$this->item($product, 100)])->assertStatus(422);
        $this->quote([['product_id' => 'x', 'quantity' => 1]])->assertStatus(422);
        $this->quote([$this->item($product)], ['delivery_method' => 'drone'])->assertStatus(422);
    }

    public function test_a_product_deleted_since_the_cart_was_filled_is_flagged_not_fatal(): void
    {
        $this->quote([['product_id' => 999999, 'quantity' => 1]])->assertOk()
            ->assertJsonPath('lines.0.product', null)
            ->assertJsonPath('lines.0.available', false)
            ->assertJsonPath('subtotal', 0);
    }

    public function test_a_query_count_does_not_grow_with_the_lines(): void
    {
        $products = collect(range(1, 6))->map(fn ($i) => $this->createProduct(['nazwa' => "P{$i}"]));

        $one = $this->countQueries(fn () => $this->quote([$this->item($products[0])])->assertOk());
        $many = $this->countQueries(fn () => $this->quote($products->map(fn ($p) => $this->item($p))->all())->assertOk());

        $this->assertSame($one, $many);
    }

    public function test_coupon_guessing_through_quote_is_rate_limited(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->quote([], ['coupon' => "KOD{$i}"])->assertOk();
        }

        $this->quote([], ['coupon' => 'KOD31'])->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);
    }

    public function test_quotes_without_a_coupon_have_a_wider_limit(): void
    {
        for ($i = 0; $i < 31; $i++) {
            $this->quote([])->assertOk();
        }
    }

    public function test_config_endpoint_exposes_only_public_settings(): void
    {
        $this->getJson('/api/config')->assertOk()
            ->assertJsonCount(4, 'pickup_points')
            ->assertJsonStructure(['pickup_points' => [['code', 'address']], 'bank_account', 'free_delivery_from'])
            ->assertJsonPath('free_delivery_from', 300);
    }

    // Saved carts

    public function test_cart_routes_need_a_login(): void
    {
        $this->getJson('/api/cart')->assertUnauthorized()->assertExactJson(['message' => 'Nie zalogowano']);
        $this->putJson('/api/cart', ['items' => []])->assertUnauthorized();
    }

    public function test_put_replaces_the_saved_cart_and_get_reads_it_back(): void
    {
        $customer = $this->createCustomer();
        $first = $this->createProduct();
        $second = $this->createProduct(['nazwa' => 'Drugi', 'cena' => 10]);
        $this->actingAs($customer, 'sanctum');

        $this->putJson('/api/cart', ['items' => [$this->item($first, 2)]])->assertOk()->assertJsonPath('subtotal', 201);

        $this->putJson('/api/cart', ['items' => [$this->item($second, 3)]])->assertOk()
            ->assertJsonCount(1, 'lines')
            ->assertJsonPath('lines.0.product.nazwa', 'Drugi');

        $this->getJson('/api/cart')->assertOk()->assertJsonPath('subtotal', 30);
        $this->assertDatabaseCount('cart_items', 1);
    }

    public function test_put_with_an_empty_list_clears_the_cart(): void
    {
        $customer = $this->createCustomer();
        $this->actingAs($customer, 'sanctum');
        $this->putJson('/api/cart', ['items' => [$this->item($this->createProduct())]])->assertOk();

        $this->putJson('/api/cart', ['items' => []])->assertOk()->assertJsonPath('lines', []);

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_repeated_lines_are_summed_and_capped_at_99(): void
    {
        $product = $this->createProduct();
        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->putJson('/api/cart', ['items' => [$this->item($product, 60), $this->item($product, 60)]])
            ->assertOk()
            ->assertJsonPath('lines.0.quantity', 99);
    }

    public function test_put_drops_lines_of_deleted_products(): void
    {
        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->putJson('/api/cart', ['items' => [['product_id' => 999999, 'quantity' => 1]]])
            ->assertOk()->assertJsonPath('lines', []);
    }

    public function test_saved_lines_that_went_out_of_stock_are_flagged_not_dropped(): void
    {
        $product = $this->createProduct([], 5);
        $this->actingAs($this->createCustomer(), 'sanctum');
        $this->putJson('/api/cart', ['items' => [$this->item($product, 2)]])->assertOk();

        $this->variantOf($product)->forceFill(['stock' => 1])->save();

        $this->getJson('/api/cart')->assertJsonPath('lines.0.available', false)->assertJsonPath('lines.0.quantity', 2);
    }

    public function test_carts_are_separate_per_customer(): void
    {
        $owner = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);

        $this->actingAs($owner, 'sanctum')
            ->putJson('/api/cart', ['items' => [$this->item($this->createProduct())]])->assertOk();

        $this->actingAs($other, 'sanctum');
        $this->putJson('/api/cart', ['items' => []])->assertOk();
        $this->getJson('/api/cart')->assertJsonPath('lines', []);

        $this->actingAs($owner, 'sanctum');
        $this->getJson('/api/cart')->assertJsonCount(1, 'lines');
    }

    public function test_a_customer_id_in_the_body_changes_nothing(): void
    {
        $owner = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);

        $this->actingAs($owner, 'sanctum')->putJson('/api/cart', [
            'customer_id' => $other->id,
            'items' => [$this->item($this->createProduct()) + ['customer_id' => $other->id]],
        ])->assertOk();

        $this->assertDatabaseHas('cart_items', ['customer_id' => $owner->id]);
        $this->assertDatabaseMissing('cart_items', ['customer_id' => $other->id]);
    }
}
