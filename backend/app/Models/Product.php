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
        'opis',
        'ocena',
        'rozmiar',
        'kolor',
        'is_active',
    ];

    protected $attributes = [
        'is_active' => true,
    ];

    protected $casts = [
        'rozmiar' => 'array',
        'kolor' => 'array',
        'cena' => 'decimal:2',
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
