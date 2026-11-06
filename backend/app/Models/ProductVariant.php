<?php

namespace App\Models;

use App\Services\CatalogService;
use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    // stock changes only through OrderService and the admin product sync.
    protected $fillable = [
        'product_id',
        'size',
        'color',
    ];

    protected $casts = [
        'stock' => 'integer',
    ];

    protected static function booted(): void
    {
        // Sizes and colors feed /catalog/filters. Stock does not, and order placement
        // changes it through the query builder, so buying does not empty the cache.
        static::saved(fn () => CatalogService::flush());
        static::deleted(fn () => CatalogService::flush());
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
