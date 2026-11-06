<?php
// app/Models/Product.php

namespace App\Models;

use App\Services\CatalogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'nazwa',
        'kategoria',
        'cena',
        'sale_price',
        'opis',
        'ocena',
        'rozmiar',
        'kolor',
        'is_active',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    protected $appends = [
        'effective_price',
        'is_on_sale',
        'discount_percent',
    ];

    protected $casts = [
        'rozmiar' => 'array',
        'kolor' => 'array',
        'cena' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'ocena' => 'decimal:1',
        'is_active' => 'boolean',
        'reviews_count' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saved(fn () => CatalogService::flush());
        static::deleted(fn () => CatalogService::flush());
    }

    protected function asJson($value, $flags = 0)
    {
        return json_encode($value, $flags | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderBy('order');
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeWithStockTotal(Builder $query): Builder
    {
        return $query->withSum('variants as stock_total', 'stock');
    }

    /** What a buyer pays. Filters and sorts read the same value from the generated column. */
    public function getEffectivePriceAttribute(): ?string
    {
        return $this->sale_price ?? $this->cena;
    }

    public function getIsOnSaleAttribute(): bool
    {
        return $this->sale_price !== null;
    }

    public function getDiscountPercentAttribute(): int
    {
        if ($this->sale_price === null) {
            return 0;
        }

        return (int) round((1 - (float) $this->sale_price / (float) $this->cena) * 100);
    }

    // A row selected without its prices cannot say whether it is on sale, so it says nothing
    // rather than answering "no" for an order line or a low stock row.
    protected function getArrayableAppends()
    {
        return array_key_exists('cena', $this->attributes) && array_key_exists('sale_price', $this->attributes)
            ? parent::getArrayableAppends()
            : [];
    }

    // SUM is a string on MySQL, a number on sqlite and NULL when there are no variants.
    public function getStockTotalAttribute($value): int
    {
        return (int) $value;
    }

    /**
     * The size and color pairs the product's option lists describe, '' for a missing option.
     *
     * @return list<array{size: string, color: string}>
     */
    public function optionCombinations(): array
    {
        $combinations = [];

        foreach (self::cleanOptions($this->rozmiar) ?: [''] as $size) {
            foreach (self::cleanOptions($this->kolor) ?: [''] as $color) {
                $combinations[] = ['size' => $size, 'color' => $color];
            }
        }

        return $combinations;
    }

    /** @return list<string> Trimmed, without blanks and duplicates. */
    public static function cleanOptions(mixed $values): array
    {
        $options = array_map(fn ($value) => trim((string) $value), (array) $values);

        return array_values(array_unique(array_filter($options, fn ($value) => $value !== '')));
    }
}
