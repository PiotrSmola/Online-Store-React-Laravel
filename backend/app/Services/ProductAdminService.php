<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

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

    // Under the row locks: an order running at the same moment either finished, and its
    // decrement is overwritten by the stock the admin typed, or waits and sees the new value.
    private function syncVariants(Product $product, array $variants): void
    {
        $existing = ProductVariant::query()->where('product_id', $product->id)->orderBy('id')->lockForUpdate()->get();
        $keep = [];

        foreach ($variants as $variant) {
            $size = trim((string) ($variant['size'] ?? ''));
            $color = trim((string) ($variant['color'] ?? ''));

            $row = $existing->first(fn (ProductVariant $row) => $row->size === $size && $row->color === $color)
                ?? new ProductVariant(['product_id' => $product->id, 'size' => $size, 'color' => $color]);

            $row->stock = $variant['stock'];
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
}
