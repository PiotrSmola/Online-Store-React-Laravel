<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductAdminService
{
    public function __construct(private ProductImageService $images)
    {
    }

    /** @param  array{variants: list<array{size: ?string, color: ?string, stock: int}>}  $data */
    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $product = Product::create(array_diff_key($data, ['variants' => true]));
            $this->syncVariants($product, $data['variants']);

            return $product;
        }, 3);
    }

    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            // Two admins saving at once take turns, so neither can create a variant the other just did.
            Product::query()->whereKey($product->id)->lockForUpdate()->first();

            $product->update(array_diff_key($data, ['variants' => true]));

            if (isset($data['variants'])) {
                $this->syncVariants($product, $data['variants']);
            }

            return $product;
        }, 3);
    }

    /** @return bool true when the product is gone, false when orders keep it as inactive */
    public function delete(Product $product): bool
    {
        if ($product->orderItems()->exists()) {
            $product->update(['is_active' => false]);

            return false;
        }

        $files = $product->images()->pluck('image_path')->all();
        $product->delete();

        foreach ($files as $file) {
            $this->images->deleteFiles($file);
        }

        return true;
    }

    /**
     * For a variant that exists, the form says what the admin saw and what they want. Only the
     * difference is applied, to the stock as it is under the lock: orders placed while the
     * form was open stay counted, and a form saved unchanged changes nothing.
     */
    private function syncVariants(Product $product, array $variants): void
    {
        $existing = ProductVariant::query()->where('product_id', $product->id)->orderBy('id')->lockForUpdate()->get();
        $keep = [];

        foreach ($variants as $index => $variant) {
            $size = trim((string) ($variant['size'] ?? ''));
            $color = trim((string) ($variant['color'] ?? ''));

            $row = $existing->first(fn (ProductVariant $row) => $row->size === $size && $row->color === $color);

            if ($row) {
                $row->stock = $this->mergedStock($row, $variant, $index);
            } else {
                $row = new ProductVariant(['product_id' => $product->id, 'size' => $size, 'color' => $color]);
                $row->stock = $variant['stock'];
            }

            $row->save();
            $keep[] = $row->id;
        }

        foreach ($existing as $row) {
            if (!in_array($row->id, $keep, true)) {
                $row->delete();
            }
        }

        $product->update([
            'rozmiar' => Product::cleanOptions(array_column($variants, 'size')),
            'kolor' => Product::cleanOptions(array_column($variants, 'color')),
        ]);
    }

    private function mergedStock(ProductVariant $row, array $variant, int $index): int
    {
        if (!isset($variant['original_stock'])) {
            throw ValidationException::withMessages([
                "variants.{$index}.original_stock" => ['Podaj stan magazynowy wczytany do formularza.'],
            ]);
        }

        return max(0, $row->stock + $variant['stock'] - $variant['original_stock']);
    }
}
