<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const BACKFILL_STOCK = 10;

    public function up(): void
    {
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // '' rather than NULL: a unique index treats every NULL as distinct.
            $table->string('size')->default('')->index();
            $table->string('color')->default('')->index();
            $table->unsignedInteger('stock')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'size', 'color']);
        });

        DB::table('products')->select('id', 'rozmiar', 'kolor')->orderBy('id')
            ->chunkById(200, function ($products) {
                foreach ($products as $product) {
                    $this->insertVariants($product);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }

    private function insertVariants(object $product): void
    {
        $now = now();
        $rows = [];

        foreach ($this->options($product->rozmiar) as $size) {
            foreach ($this->options($product->kolor) as $color) {
                $rows[] = [
                    'product_id' => $product->id,
                    'size' => $size,
                    'color' => $color,
                    'stock' => self::BACKFILL_STOCK,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // MySQL's unique index ignores case and accents, so two values that differ only
        // that way become one variant there instead of failing the migration.
        DB::table('product_variants')->insertOrIgnore($rows);
    }

    /** @return list<string> A list with '' when the product has no such option. */
    private function options(?string $json): array
    {
        $values = array_map(fn ($value) => trim((string) $value), (array) json_decode($json ?? 'null', true));
        $values = array_values(array_unique(array_filter($values, fn ($value) => $value !== '')));

        return $values ?: [''];
    }
};
