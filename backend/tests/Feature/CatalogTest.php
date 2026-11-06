<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductImage;
use App\Support\LikeSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use BuildsOrders, CountsQueries, RefreshDatabase;

    /** @return list<string> */
    private function names(string $query): array
    {
        return array_column($this->getJson('/api/products' . $query)->assertOk()->json('data'), 'nazwa');
    }

    public function test_list_is_paginated_with_twelve_products_by_default(): void
    {
        for ($i = 0; $i < 13; $i++) {
            $this->createProduct(['nazwa' => "Produkt {$i}"]);
        }

        $this->getJson('/api/products')->assertOk()
            ->assertJsonCount(12, 'data')
            ->assertJsonPath('total', 13)
            ->assertJsonPath('per_page', 12)
            ->assertJsonPath('last_page', 2);

        $this->getJson('/api/products?page=2')->assertJsonCount(1, 'data');
    }

    public function test_per_page_is_limited_to_48(): void
    {
        $this->getJson('/api/products?per_page=48')->assertOk();
        $this->getJson('/api/products?per_page=49')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
    }

    public function test_list_cards_have_images_and_stock_but_no_description_or_variants(): void
    {
        $product = $this->createProduct([], 3);
        ProductImage::create(['product_id' => $product->id, 'image_path' => 'a.jpg', 'order' => 0]);

        $card = $this->getJson('/api/products')->assertOk()->json('data.0');

        $this->assertSame('a.jpg', $card['images'][0]['image_path']);
        $this->assertSame(12, $card['stock_total']);
        $this->assertSame('100.50', $card['cena']);
        $this->assertArrayNotHasKey('opis', $card);
        $this->assertArrayNotHasKey('variants', $card);
    }

    public function test_product_without_variants_has_a_stock_total_of_zero(): void
    {
        $product = $this->createProduct();
        $product->variants()->delete();

        $this->getJson('/api/products')->assertJsonPath('data.0.stock_total', 0);
    }

    public function test_inactive_products_are_hidden(): void
    {
        $hidden = $this->createProduct(['is_active' => false, 'kategoria' => 'Ukryta']);
        $this->createProduct(['nazwa' => 'Widoczny']);

        $this->assertSame(['Widoczny'], $this->names(''));
        $this->getJson("/api/products/{$hidden->id}")->assertNotFound();
        $this->assertNotContains('Ukryta', $this->getJson('/api/categories')->json());
    }

    public function test_filters_by_category_and_price(): void
    {
        $this->createProduct(['nazwa' => 'Tania', 'kategoria' => 'Kurtki', 'cena' => 50]);
        $this->createProduct(['nazwa' => 'Droga', 'kategoria' => 'Kurtki', 'cena' => 500]);
        $this->createProduct(['nazwa' => 'But', 'kategoria' => 'Obuwie', 'cena' => 100]);

        $this->assertEqualsCanonicalizing(['Tania', 'Droga'], $this->names('?category=Kurtki'));
        $this->assertEqualsCanonicalizing(['But', 'Droga'], $this->names('?min_price=100'));
        $this->assertEqualsCanonicalizing(['Tania', 'But'], $this->names('?max_price=100'));
        $this->assertSame(['But'], $this->names('?min_price=60&max_price=200'));
    }

    public function test_size_and_color_must_match_on_the_same_variant(): void
    {
        $product = $this->createProduct(['nazwa' => 'Niepełna']);
        $this->variantOf($product, 'S', 'Czarny')->delete();

        $this->assertSame(['Niepełna'], $this->names('?size=S'));
        $this->assertSame(['Niepełna'], $this->names('?color=Czarny'));
        $this->assertSame([], $this->names('?size=S&color=Czarny'));
        $this->assertSame(['Niepełna'], $this->names('?size=M&color=Czarny'));
    }

    public function test_search_finds_a_part_of_the_name(): void
    {
        $this->createProduct(['nazwa' => 'Skórzana kurtka ramoneska']);
        $this->createProduct(['nazwa' => 'Kombinezon', 'kategoria' => 'Odzież']);

        $this->assertSame(['Skórzana kurtka ramoneska'], $this->names('?q=ramoneska'));
    }

    public static function likeWildcards(): array
    {
        return [
            'percent' => ['%', '100% bawełna'],
            'underscore' => ['_', 'Pasek_skórzany'],
            'the escape character itself' => ['!', 'Wyprzedaż!'],
            'a backslash' => ['\\', 'A\\B'],
        ];
    }

    #[DataProvider('likeWildcards')]
    public function test_like_wildcards_in_the_term_match_only_themselves(string $term, string $matching): void
    {
        $this->createProduct(['nazwa' => $matching]);
        $this->createProduct(['nazwa' => 'Zwykły produkt', 'kategoria' => 'Inne']);

        $this->assertSame([$matching], $this->names('?q=' . rawurlencode($term)));
    }

    public function test_the_escape_helper_doubles_its_own_escape_character(): void
    {
        $this->assertSame('50!%!_!!', LikeSearch::escape('50%_!'));
    }

    public function test_sql_in_the_search_term_is_treated_as_text(): void
    {
        $this->createProduct(['nazwa' => 'Kurtka']);

        foreach (["' OR '1'='1", "'; DROP TABLE products; --", '" OR 1=1 --'] as $attack) {
            $this->assertSame([], $this->names('?q=' . rawurlencode($attack)));
        }

        $this->assertSame(1, Product::count());
    }

    public static function sorts(): array
    {
        return [
            'newest' => ['newest', ['C', 'B', 'A']],
            'price ascending' => ['price_asc', ['B', 'A', 'C']],
            'price descending' => ['price_desc', ['C', 'A', 'B']],
            'name' => ['name', ['A', 'B', 'C']],
            'rating' => ['rating', ['B', 'C', 'A']],
        ];
    }

    #[DataProvider('sorts')]
    public function test_sort_options(string $sort, array $expected): void
    {
        $this->createProduct(['nazwa' => 'A', 'cena' => 20, 'ocena' => 3.0]);
        $this->createProduct(['nazwa' => 'B', 'cena' => 10, 'ocena' => 5.0]);
        $this->createProduct(['nazwa' => 'C', 'cena' => 30, 'ocena' => 4.0]);

        $this->assertSame($expected, $this->names("?sort={$sort}"));
    }

    public static function forbiddenSorts(): array
    {
        return [
            'a real column' => ['opis'],
            'sql' => ['cena;DROP TABLE products'],
            'an expression' => ['(select password from customers limit 1)'],
        ];
    }

    #[DataProvider('forbiddenSorts')]
    public function test_sort_outside_the_whitelist_is_rejected(string $sort): void
    {
        $this->getJson('/api/products?sort=' . rawurlencode($sort))
            ->assertStatus(422)->assertJsonValidationErrors(['sort']);
    }

    public function test_validation_messages_are_polish(): void
    {
        $this->assertStringContainsString(
            'nie może być większe',
            $this->getJson('/api/products?per_page=49')->json('errors.per_page.0')
        );
    }

    public function test_the_products_query_count_does_not_grow_with_the_page(): void
    {
        $one = $this->createProduct();
        ProductImage::create(['product_id' => $one->id, 'image_path' => 'a.jpg', 'order' => 0]);
        $small = $this->countQueries(fn () => $this->getJson('/api/products')->assertJsonCount(1, 'data'));

        for ($i = 0; $i < 11; $i++) {
            $product = $this->createProduct(['nazwa' => "Produkt {$i}"]);
            ProductImage::create(['product_id' => $product->id, 'image_path' => "{$i}.jpg", 'order' => 0]);
        }
        $large = $this->countQueries(fn () => $this->getJson('/api/products')->assertJsonCount(12, 'data'));

        $this->assertSame($small, $large);
        $this->assertLessThanOrEqual(3, $large);
    }

    public function test_detail_has_description_variants_and_related_products(): void
    {
        $product = $this->createProduct([], 2);
        $this->createProduct(['nazwa' => 'Inny kolor', 'cena' => 10]);
        $this->createProduct(['nazwa' => 'Inna kategoria', 'kategoria' => 'Obuwie']);

        $response = $this->getJson("/api/products/{$product->id}")->assertOk()
            ->assertJsonPath('opis', 'Opis produktu')
            ->assertJsonPath('stock_total', 8)
            ->assertJsonCount(4, 'variants')
            ->assertJsonCount(1, 'related')
            ->assertJsonPath('related.0.nazwa', 'Inny kolor');

        $this->assertArrayNotHasKey('opis', $response->json('related.0'));
    }

    public function test_related_products_stop_at_four(): void
    {
        $product = $this->createProduct();
        for ($i = 0; $i < 6; $i++) {
            $this->createProduct(['nazwa' => "Produkt {$i}"]);
        }

        $this->getJson("/api/products/{$product->id}")->assertJsonCount(4, 'related');
    }

    public function test_removed_category_route_is_gone(): void
    {
        $this->createProduct();

        $this->getJson('/api/products/category/Kurtki')->assertNotFound();
    }

    public function test_missing_product_gets_a_polish_404_that_names_nothing(): void
    {
        $this->getJson('/api/products/999')->assertNotFound()->assertExactJson(['message' => 'Nie znaleziono']);
    }

    public function test_catalog_filters_list_categories_options_and_prices(): void
    {
        $this->createProduct(['kategoria' => 'Kurtki', 'cena' => 50, 'rozmiar' => ['XL', 'S', '42'], 'kolor' => ['Czarny']]);
        $this->createProduct(['kategoria' => 'Kurtki', 'cena' => 70, 'rozmiar' => ['M'], 'kolor' => ['Biały']]);
        $this->createProduct(['kategoria' => 'Obuwie', 'cena' => 500, 'rozmiar' => [], 'kolor' => ['Zielony']]);
        $this->createProduct(['kategoria' => 'Ukryta', 'is_active' => false, 'cena' => 9000, 'rozmiar' => ['XXS']]);

        $this->getJson('/api/catalog/filters')->assertOk()->assertExactJson([
            'categories' => [['name' => 'Kurtki', 'count' => 2], ['name' => 'Obuwie', 'count' => 1]],
            'sizes' => ['42', 'S', 'M', 'XL'],
            'colors' => ['Biały', 'Czarny', 'Zielony'],
            'price' => ['min' => 50, 'max' => 500],
            'counts' => ['new' => 0, 'on_sale' => 0],
        ]);

        $this->getJson('/api/catalog/filters?category=Kurtki')->assertOk()
            ->assertJsonPath('sizes', ['42', 'S', 'M', 'XL'])
            ->assertJsonPath('colors', ['Biały', 'Czarny'])
            ->assertJsonPath('price', ['min' => 50, 'max' => 70])
            ->assertJsonCount(2, 'categories');
    }

    public function test_is_new_filter_and_flag(): void
    {
        $this->createProduct(['nazwa' => 'Nowość', 'is_new' => true]);
        $this->createProduct(['nazwa' => 'Stary']);

        $this->assertSame(['Nowość'], $this->names('?is_new=1'));
        $this->assertCount(2, $this->names('?is_new=0'));
        $this->getJson('/api/products?is_new=1')->assertJsonPath('data.0.is_new', true);
        $this->getJson('/api/products?is_new=tak')->assertStatus(422)->assertJsonValidationErrors(['is_new']);
    }

    public function test_new_and_on_sale_filters_combine(): void
    {
        $this->createProduct(['nazwa' => 'Oba', 'is_new' => true, 'cena' => 100, 'sale_price' => 50]);
        $this->createProduct(['nazwa' => 'Tylko nowy', 'is_new' => true]);
        $this->createProduct(['nazwa' => 'Tylko promocja', 'cena' => 100, 'sale_price' => 50]);

        $this->assertSame(['Oba'], $this->names('?is_new=1&on_sale=1'));
    }

    public function test_filters_count_new_and_on_sale_products(): void
    {
        $this->createProduct(['kategoria' => 'Kurtki', 'is_new' => true]);
        $this->createProduct(['kategoria' => 'Kurtki', 'is_new' => true, 'cena' => 100, 'sale_price' => 50]);
        $this->createProduct(['kategoria' => 'Obuwie', 'cena' => 100, 'sale_price' => 50]);
        $this->createProduct(['kategoria' => 'Obuwie', 'is_new' => true, 'is_active' => false]);

        $this->getJson('/api/catalog/filters')->assertJsonPath('counts', ['new' => 2, 'on_sale' => 2]);
        $this->getJson('/api/catalog/filters?category=Obuwie')->assertJsonPath('counts', ['new' => 0, 'on_sale' => 1]);
        $this->getJson('/api/catalog/filters?category=Nie%20ma')->assertJsonPath('counts', ['new' => 0, 'on_sale' => 0]);
    }

    public function test_marking_a_product_new_refreshes_the_cached_counts(): void
    {
        $product = $this->createProduct();
        $this->getJson('/api/catalog/filters')->assertJsonPath('counts.new', 0);

        $product->update(['is_new' => true]);

        $this->getJson('/api/catalog/filters')->assertJsonPath('counts.new', 1);
    }

    public function test_seeding_marks_a_few_products_new_the_same_way_each_time(): void
    {
        $this->artisan('shop:seed --local')->assertSuccessful();
        $this->artisan('shop:seed --local')->assertSuccessful();

        $rows = Product::query()->orderBy('id')->pluck('is_new')->all();
        [$first, $second] = array_chunk($rows, count($rows) / 2);

        $this->assertSame($first, $second);
        $this->assertContains(true, $first);
        $this->assertContains(false, $first);
    }

    public function test_unknown_category_gets_empty_options(): void
    {
        $this->createProduct();

        $this->getJson('/api/catalog/filters?category=Nie%20ma')->assertOk()
            ->assertJsonPath('sizes', [])
            ->assertJsonPath('price', ['min' => null, 'max' => null]);
    }

    public function test_categories_stay_a_list_of_names(): void
    {
        $this->createProduct(['kategoria' => 'Obuwie']);
        $this->createProduct(['kategoria' => 'Kurtki']);
        $this->createProduct(['kategoria' => 'Kurtki']);

        $this->getJson('/api/categories')->assertOk()->assertExactJson(['Kurtki', 'Obuwie']);
    }

    public function test_catalog_lookups_are_cached(): void
    {
        $this->createProduct();
        $this->getJson('/api/catalog/filters')->assertOk();
        $this->getJson('/api/categories')->assertOk();

        $queries = $this->countQueries(function () {
            $this->getJson('/api/catalog/filters')->assertOk();
            $this->getJson('/api/categories')->assertOk();
        });

        $this->assertSame(0, $queries);
    }

    public function test_changing_a_product_refreshes_the_cached_filters(): void
    {
        $product = $this->createProduct(['kategoria' => 'Kurtki']);
        $this->assertSame(['Kurtki'], $this->getJson('/api/categories')->json());

        $product->update(['kategoria' => 'Płaszcze']);

        $this->assertSame(['Płaszcze'], $this->getJson('/api/categories')->json());
    }

    public function test_deleting_a_product_refreshes_the_cached_filters(): void
    {
        $product = $this->createProduct();
        $this->assertSame(['Kurtki'], $this->getJson('/api/categories')->json());

        $product->delete();

        $this->assertSame([], $this->getJson('/api/categories')->json());
    }

    public function test_changing_a_variant_refreshes_the_cached_filters(): void
    {
        $product = $this->createProduct(['rozmiar' => ['S'], 'kolor' => []]);
        $this->assertSame(['S'], $this->getJson('/api/catalog/filters')->json('sizes'));

        $product->variants()->create(['size' => 'L', 'color' => '']);

        $this->assertSame(['S', 'L'], $this->getJson('/api/catalog/filters')->json('sizes'));
    }

    public function test_a_stock_change_does_not_touch_the_cache_version(): void
    {
        $product = $this->createProduct();
        $version = Cache::get('catalog:version');

        $this->variantOf($product)->newQuery()->whereKey($this->variantOf($product)->id)->decrement('stock');

        $this->assertSame($version, Cache::get('catalog:version'));
    }
}
