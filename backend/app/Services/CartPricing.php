<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;

/**
 * The one place that turns cart items into money. All arithmetic is in grosze, so
 * totals do not pick up float errors; amounts leave as PLN numbers with two decimals.
 */
class CartPricing
{
    /**
     * @param  list<array{product_id: int, quantity: int, size?: ?string, color?: ?string}>  $items
     * @param  bool  $lock  Read stock and the coupon with FOR UPDATE. Needs an open transaction.
     *                      Without it a MySQL transaction could price against an older snapshot.
     */
    public function quote(array $items, ?string $coupon = null, ?string $deliveryMethod = null, bool $lock = false): array
    {
        $items = $this->merge($items);
        $productIds = array_column($items, 'product_id');

        $products = Product::query()
            ->select([...CatalogService::LIST_COLUMNS, 'is_active'])
            ->with(CatalogService::IMAGE_COLUMNS)
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        $variants = ProductVariant::query()
            ->whereIn('product_id', $productIds)
            ->orderBy('id')
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->get()
            ->groupBy('product_id');

        $lines = array_map(
            fn (array $item) => $this->line($item, $products->get($item['product_id']), $variants->get($item['product_id'], collect())),
            $items
        );

        $subtotal = array_sum(array_map(fn (array $line) => $line['available'] ? $this->grosze($line['line_total']) : 0, $lines));
        $applied = filled($coupon) ? $this->applyCoupon($coupon, $subtotal, $lock) : [null, 0, null];

        return $this->summary($lines, $subtotal, $applied[1], $applied[0], $applied[2], $deliveryMethod);
    }

    /** @return array{0: ?array{code: string, label: string}, 1: int, 2: ?string} coupon, discount, error */
    private function applyCoupon(string $code, int $subtotal, bool $lock): array
    {
        $coupon = Coupon::query()
            ->where('code', Coupon::normalizeCode($code))
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->first();

        $error = $coupon ? $coupon->rejectionFor($subtotal) : Coupon::unknownCodeMessage();

        if ($error) {
            return [null, 0, $error];
        }

        return [['code' => $coupon->code, 'label' => $coupon->label], $coupon->discountFor($subtotal), null];
    }

    /**
     * @return array{size: ?string, color: ?string} Polish messages, null when the choice is fine.
     */
    public function optionErrors(Product $product, ?string $size, ?string $color): array
    {
        return [
            'size' => $this->optionError($product, 'rozmiar', $product->rozmiar, $size),
            'color' => $this->optionError($product, 'kolor', $product->kolor, $color),
        ];
    }

    // $offered is the product's JSON column, which can be null or an empty list.
    private function optionError(Product $product, string $label, mixed $offered, ?string $selected): ?string
    {
        $options = Product::cleanOptions($offered);

        if ($options === []) {
            return blank($selected) ? null : "Produkt „{$product->nazwa}” nie ma opcji: {$label}";
        }

        if (blank($selected)) {
            return "Wybierz {$label} produktu „{$product->nazwa}”";
        }

        return in_array($selected, $options, true)
            ? null
            : "Wybrany {$label} produktu „{$product->nazwa}” jest niedostępny";
    }

    /** Equal variants become one line, so together they cannot exceed the stock. */
    private function merge(array $items): array
    {
        $merged = [];

        foreach ($items as $item) {
            $size = trim((string) ($item['size'] ?? ''));
            $color = trim((string) ($item['color'] ?? ''));
            $key = "{$item['product_id']}:{$size}:{$color}";

            $merged[$key]['key'] = $key;
            $merged[$key]['product_id'] = (int) $item['product_id'];
            $merged[$key]['size'] = $size;
            $merged[$key]['color'] = $color;
            $merged[$key]['quantity'] = ($merged[$key]['quantity'] ?? 0) + (int) $item['quantity'];
        }

        return array_values($merged);
    }

    private function line(array $item, ?Product $product, Collection $variants): array
    {
        $variant = $variants->first(fn (ProductVariant $variant) => $variant->size === $item['size'] && $variant->color === $item['color']);
        $stock = $variant?->stock ?? 0;
        $unitPrice = $product ? $this->grosze($product->effective_price) : 0;
        $error = $this->lineError($item, $product, $variant);

        return [
            'key' => $item['key'],
            'variant_id' => $variant?->id,
            'product' => $product,
            'size' => $item['size'],
            'color' => $item['color'],
            'quantity' => $item['quantity'],
            'unit_price' => $this->money($unitPrice),
            'line_total' => $this->money($unitPrice * $item['quantity']),
            'stock' => $stock,
            'available' => $error === null,
            'error' => $error,
        ];
    }

    private function lineError(array $item, ?Product $product, ?ProductVariant $variant): ?string
    {
        if (!$product || !$product->is_active) {
            return 'Ten produkt jest już niedostępny';
        }

        $options = $this->optionErrors($product, $item['size'], $item['color']);

        if ($options['size'] || $options['color']) {
            return $options['size'] ?? $options['color'];
        }

        if (!$variant) {
            return "Ten wariant produktu „{$product->nazwa}” jest niedostępny";
        }

        if ($variant->stock === 0) {
            return "Produkt „{$product->nazwa}” jest wyprzedany";
        }

        if ($variant->stock < $item['quantity']) {
            return "Dostępna ilość produktu „{$product->nazwa}”: {$variant->stock} szt.";
        }

        return null;
    }

    private function summary(array $lines, int $subtotal, int $discount, ?array $coupon, ?string $couponError, ?string $deliveryMethod): array
    {
        $afterDiscount = $subtotal - $discount;
        $threshold = $this->grosze(config('shop.free_delivery_from'));
        $isFree = $afterDiscount >= $threshold;

        $options = [];
        foreach (config('shop.delivery_methods') as $value => $method) {
            $options[$value] = [
                'value' => $value,
                'label' => $method['label'],
                'price' => $isFree ? 0.0 : (float) $method['price'],
            ];
        }

        $deliveryPrice = $options[$deliveryMethod]['price'] ?? null;

        return [
            'lines' => $lines,
            'subtotal' => $this->money($subtotal),
            'discount' => $this->money($discount),
            'coupon' => $coupon,
            'coupon_error' => $couponError,
            'delivery_options' => array_values($options),
            'delivery_price' => $deliveryPrice,
            'free_delivery_from' => (float) config('shop.free_delivery_from'),
            'free_delivery_missing' => $this->money(max(0, $threshold - $afterDiscount)),
            'total' => $this->money($afterDiscount + $this->grosze($deliveryPrice ?? 0)),
        ];
    }

    private function grosze(float|int|string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function money(int $grosze): float
    {
        return $grosze / 100;
    }
}
