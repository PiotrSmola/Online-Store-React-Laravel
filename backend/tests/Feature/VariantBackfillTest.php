<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Runs the real migrations over rows written by the previous schema. The suite's sqlite
 * database is in memory, so nothing here leaks into the RefreshDatabase tests.
 */
class VariantBackfillTest extends TestCase
{
    private const FIRST_NEW_MIGRATION = '2026_11_06_100000_add_catalog_columns_to_products_table';

    protected function setUp(): void
    {
        parent::setUp();

        Artisan::call('migrate:fresh');
        Artisan::call('migrate:rollback', [
            '--step' => DB::table('migrations')->where('migration', '>=', self::FIRST_NEW_MIGRATION)->count(),
        ]);
    }

    private function oldProduct(mixed $sizes, mixed $colors): int
    {
        return DB::table('products')->insertGetId([
            'nazwa' => 'Stary produkt',
            'kategoria' => 'Kurtki',
            'cena' => 10,
            'opis' => 'Opis',
            'ocena' => 4.5,
            'rozmiar' => $sizes === null ? null : json_encode($sizes),
            'kolor' => $colors === null ? null : json_encode($colors),
        ]);
    }

    public function test_variants_are_the_cartesian_product_with_stock_ten(): void
    {
        $id = $this->oldProduct(['S', 'M'], ['Czarny', 'Biały']);

        Artisan::call('migrate');

        $variants = DB::table('product_variants')->where('product_id', $id)->orderBy('id')->get();
        $this->assertSame(
            ['S|Czarny', 'S|Biały', 'M|Czarny', 'M|Biały'],
            $variants->map(fn ($variant) => "{$variant->size}|{$variant->color}")->all()
        );
        $this->assertSame([10], $variants->pluck('stock')->map(fn ($stock) => (int) $stock)->unique()->values()->all());
    }

    public function test_missing_options_become_empty_strings(): void
    {
        $noOptions = $this->oldProduct(null, []);
        $colorsOnly = $this->oldProduct([], ['Brązowy']);
        $blanks = $this->oldProduct(['', ' '], [null]);

        Artisan::call('migrate');

        foreach ([[$noOptions, ''], [$colorsOnly, 'Brązowy'], [$blanks, '']] as [$id, $color]) {
            $variant = DB::table('product_variants')->where('product_id', $id)->sole();
            $this->assertSame('', $variant->size);
            $this->assertSame($color, $variant->color);
        }
    }

    public function test_stored_options_are_trimmed_and_deduplicated(): void
    {
        $id = $this->oldProduct([' S ', 'S'], ["Czarny\n"]);

        Artisan::call('migrate');

        $variant = DB::table('product_variants')->where('product_id', $id)->sole();
        $this->assertSame('S', $variant->size);
        $this->assertSame('Czarny', $variant->color);
    }

    public function test_existing_products_stay_active_with_no_reviews(): void
    {
        $id = $this->oldProduct(['S'], ['Czarny']);

        Artisan::call('migrate');

        $product = Product::findOrFail($id);
        $this->assertTrue($product->is_active);
        $this->assertSame(0, $product->reviews_count);
        $this->assertSame(10, Product::whereKey($id)->withStockTotal()->sole()->stock_total);
    }

    public function test_existing_products_get_their_regular_price_as_the_effective_price(): void
    {
        $id = $this->oldProduct(['S'], ['Czarny']);

        Artisan::call('migrate');

        $row = DB::table('products')->where('id', $id)->first();
        $this->assertNull($row->sale_price);
        $this->assertEquals(10, $row->effective_price);
    }

    public function test_the_variant_unique_index_refuses_a_duplicate(): void
    {
        $id = $this->oldProduct(['S'], ['Czarny']);
        Artisan::call('migrate');

        $this->expectException(UniqueConstraintViolationException::class);

        DB::table('product_variants')->insert(['product_id' => $id, 'size' => 'S', 'color' => 'Czarny', 'stock' => 1]);
    }
}
