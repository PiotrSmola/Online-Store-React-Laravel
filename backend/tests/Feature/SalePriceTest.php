<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Services\InvoiceService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class SalePriceTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, RefreshDatabase;

    /** @return list<string> */
    private function names(string $query): array
    {
        return array_column($this->getJson('/api/products' . $query)->assertOk()->json('data'), 'nazwa');
    }

    private function quote(Product $product, array $extra = []): TestResponse
    {
        return $this->postJson('/api/cart/quote', [
            'items' => [['product_id' => $product->id, 'quantity' => $extra['quantity'] ?? 1, 'size' => 'M', 'color' => 'Czarny']],
            'delivery_method' => 'courier',
        ] + array_diff_key($extra, ['quantity' => true]));
    }

    public function test_product_exposes_the_effective_price_and_discount(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 150]);

        $this->getJson("/api/products/{$product->id}")->assertOk()
            ->assertJsonPath('cena', '200.00')
            ->assertJsonPath('sale_price', '150.00')
            ->assertJsonPath('effective_price', '150.00')
            ->assertJsonPath('is_on_sale', true)
            ->assertJsonPath('discount_percent', 25);

        $this->getJson('/api/products')->assertOk()
            ->assertJsonPath('data.0.effective_price', '150.00')
            ->assertJsonPath('data.0.is_on_sale', true)
            ->assertJsonPath('data.0.discount_percent', 25);
    }

    public function test_product_without_a_sale_uses_its_regular_price(): void
    {
        $product = $this->createProduct(['cena' => 200]);

        $this->getJson("/api/products/{$product->id}")
            ->assertJsonPath('sale_price', null)
            ->assertJsonPath('effective_price', '200.00')
            ->assertJsonPath('is_on_sale', false)
            ->assertJsonPath('discount_percent', 0);
    }

    public function test_a_row_selected_without_its_prices_claims_nothing(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 150]);

        $partial = Product::query()->select('id', 'nazwa')->findOrFail($product->id)->toArray();

        $this->assertArrayNotHasKey('is_on_sale', $partial);
        $this->assertArrayNotHasKey('effective_price', $partial);
    }

    public function test_the_generated_column_follows_every_write(): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $stored = fn () => (float) DB::table('products')->where('id', $product->id)->value('effective_price');
        $this->assertSame(200.0, $stored());

        $product->update(['sale_price' => 150]);
        $this->assertSame(150.0, $stored());

        // A direct update skips every model hook; a synced column would go stale here.
        DB::table('products')->where('id', $product->id)->update(['sale_price' => 120]);
        $this->assertSame(120.0, $stored());

        DB::table('products')->where('id', $product->id)->update(['sale_price' => null, 'cena' => 300]);
        $this->assertSame(300.0, $stored());
    }

    public function test_prices_used_by_filters_and_sorts_are_indexed(): void
    {
        $this->assertTrue(Schema::hasIndex('products', 'products_effective_price_index'));
        $this->assertTrue(Schema::hasIndex('products', 'products_sale_price_index'));
    }

    public function test_on_sale_filter(): void
    {
        $this->createProduct(['nazwa' => 'Promocja', 'cena' => 200, 'sale_price' => 150]);
        $this->createProduct(['nazwa' => 'Zwykły', 'cena' => 200]);

        $this->assertSame(['Promocja'], $this->names('?on_sale=1'));
        $this->assertCount(2, $this->names('?on_sale=0'));
        $this->assertCount(2, $this->names(''));
        $this->getJson('/api/products?on_sale=tak')->assertStatus(422)->assertJsonValidationErrors(['on_sale']);
    }

    public function test_price_filters_use_the_effective_price(): void
    {
        $this->createProduct(['nazwa' => 'Promocja', 'cena' => 200, 'sale_price' => 50]);
        $this->createProduct(['nazwa' => 'Zwykły', 'cena' => 100]);

        $this->assertSame(['Promocja'], $this->names('?max_price=60'));
        $this->assertSame(['Zwykły'], $this->names('?min_price=60'));
        $this->assertSame([], $this->names('?min_price=150'));
    }

    public static function priceSorts(): array
    {
        return [
            'ascending' => ['price_asc', ['Promocja', 'Środek', 'Drogi']],
            'descending' => ['price_desc', ['Drogi', 'Środek', 'Promocja']],
        ];
    }

    #[DataProvider('priceSorts')]
    public function test_price_sorts_use_the_effective_price(string $sort, array $expected): void
    {
        // By regular price alone, Promocja would be the most expensive.
        $this->createProduct(['nazwa' => 'Promocja', 'cena' => 500, 'sale_price' => 10]);
        $this->createProduct(['nazwa' => 'Środek', 'cena' => 100]);
        $this->createProduct(['nazwa' => 'Drogi', 'cena' => 300]);

        $this->assertSame($expected, $this->names("?sort={$sort}"));
    }

    public function test_catalog_price_range_uses_the_effective_price(): void
    {
        $this->createProduct(['cena' => 500, 'sale_price' => 10]);
        $this->createProduct(['cena' => 100]);

        $this->getJson('/api/catalog/filters')->assertJsonPath('price', ['min' => 10, 'max' => 100]);
    }

    public function test_quote_charges_the_effective_price(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 149.99]);

        $this->quote($product, ['quantity' => 2])
            ->assertJsonPath('lines.0.unit_price', 149.99)
            ->assertJsonPath('lines.0.line_total', 299.98)
            ->assertJsonPath('lines.0.product.effective_price', '149.99')
            ->assertJsonPath('subtotal', 299.98);
    }

    public function test_free_delivery_counts_the_sale_price_not_the_regular_one(): void
    {
        // 400 regular would clear the threshold, 250 on sale does not.
        $this->quote($this->createProduct(['cena' => 400, 'sale_price' => 250]))
            ->assertJsonPath('delivery_price', 15.99)
            ->assertJsonPath('free_delivery_missing', 50);
    }

    public function test_coupon_is_worked_out_from_the_sale_price(): void
    {
        Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);

        $this->quote($this->createProduct(['cena' => 200, 'sale_price' => 100]), ['coupon' => 'WITAJ10'])
            ->assertJsonPath('discount', 10);
    }

    public function test_coupon_minimum_is_checked_against_the_sale_price(): void
    {
        Coupon::create(['code' => 'MINUS20', 'type' => 'fixed', 'value' => 20, 'min_order' => 150]);

        $this->assertNotNull(
            $this->quote($this->createProduct(['cena' => 200, 'sale_price' => 100]), ['coupon' => 'MINUS20'])->json('coupon_error')
        );
    }

    public function test_order_item_keeps_the_price_paid_after_the_sale_ends(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 150]);

        $this->postJson('/api/orders', $this->orderPayload($product))->assertOk();

        $product->update(['sale_price' => null, 'cena' => 999]);

        $order = Order::sole();
        $this->assertSame('150.00', $order->items->sole()->price);
        $this->assertSame('150.00', $order->subtotal_amount);
        $this->assertSame('165.99', $order->total_amount);
    }

    public function test_invoice_uses_the_price_paid(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 123]);
        $order = app(OrderService::class)->place($this->createCustomer(), [
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'store_pickup',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
        ]);
        $product->update(['sale_price' => null]);

        $this->assertEquals(123, app(InvoiceService::class)->amounts($order)['totals']['gross']);
    }

    // Admin

    private function asAdmin(): void
    {
        $this->actingAs($this->createAdmin(), 'sanctum');
    }

    public function test_admin_can_set_and_clear_a_sale_price(): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['sale_price' => 150])->assertOk()
            ->assertJsonPath('sale_price', '150.00')
            ->assertJsonPath('is_on_sale', true);

        $this->putJson("/api/admin/products/{$product->id}", ['sale_price' => null])->assertOk()
            ->assertJsonPath('sale_price', null)
            ->assertJsonPath('is_on_sale', false)
            ->assertJsonPath('effective_price', '200.00');
    }

    public function test_admin_can_create_a_product_on_sale(): void
    {
        $this->asAdmin();

        $this->postJson('/api/admin/products', [
            'nazwa' => 'Nowa',
            'kategoria' => 'Kurtki',
            'cena' => 100,
            'sale_price' => 80,
            'opis' => 'Opis',
            'variants' => [['size' => 'M', 'color' => '', 'stock' => 1]],
        ])->assertCreated()->assertJsonPath('discount_percent', 20);
    }

    public static function badSalePrices(): array
    {
        return [
            'equal to the price' => [200],
            'above the price' => [200.01],
            'zero' => [0],
            'negative' => [-5],
            'text' => ['tanio'],
        ];
    }

    #[DataProvider('badSalePrices')]
    public function test_bad_sale_prices_are_refused(mixed $salePrice): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['sale_price' => $salePrice])
            ->assertStatus(422)->assertJsonValidationErrors(['sale_price']);

        $this->assertNull($product->fresh()->sale_price);
    }

    public function test_sale_price_is_checked_against_a_price_sent_with_it(): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['cena' => 100, 'sale_price' => 150])
            ->assertStatus(422)->assertJsonValidationErrors(['sale_price']);

        $this->putJson("/api/admin/products/{$product->id}", ['cena' => 300, 'sale_price' => 250])->assertOk();
    }

    public function test_lowering_the_price_under_an_existing_sale_is_refused(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 150]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['cena' => 100])
            ->assertStatus(422)->assertJsonValidationErrors(['sale_price']);

        $this->assertSame('200.00', $product->fresh()->cena);
    }

    public function test_lowering_the_price_and_clearing_the_sale_together_works(): void
    {
        $product = $this->createProduct(['cena' => 200, 'sale_price' => 150]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['cena' => 100, 'sale_price' => null])->assertOk();
    }

    public function test_the_effective_price_cannot_be_written_through_the_api(): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $this->asAdmin();

        $this->putJson("/api/admin/products/{$product->id}", ['effective_price' => 1, 'discount_percent' => 99])->assertOk();

        $this->assertSame('200.00', $product->fresh()->effective_price);
    }

    public function test_changing_a_sale_refreshes_the_cached_price_range(): void
    {
        $product = $this->createProduct(['cena' => 200]);
        $this->assertEquals(200, $this->getJson('/api/catalog/filters')->json('price.min'));

        $product->update(['sale_price' => 100]);

        $this->assertEquals(100, $this->getJson('/api/catalog/filters')->json('price.min'));
    }

    // Seeding

    public function test_seeding_puts_a_few_products_on_sale_the_same_way_each_time(): void
    {
        $this->artisan('shop:seed --local')->assertSuccessful();
        $this->artisan('shop:seed --local')->assertSuccessful();

        $rows = Product::query()->orderBy('id')->pluck('sale_price')->all();
        [$first, $second] = array_chunk($rows, count($rows) / 2);

        $this->assertSame($first, $second);
        $this->assertGreaterThan(0, count(array_filter($first)));
        $this->assertLessThan(count($first), count(array_filter($first)));

        Product::query()->whereNotNull('sale_price')->lazyById()->each(function (Product $product) {
            $this->assertLessThan((float) $product->cena, (float) $product->sale_price);
        });

    }
}
