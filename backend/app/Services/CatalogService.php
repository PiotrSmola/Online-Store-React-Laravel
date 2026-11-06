<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\LikeSearch;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CatalogService
{
    /** The only orderings a request can ask for. Keys are the accepted `sort` values. */
    public const SORTS = [
        'newest' => [['created_at', 'desc']],
        'price_asc' => [['cena', 'asc']],
        'price_desc' => [['cena', 'desc']],
        'name' => [['nazwa', 'asc']],
        'rating' => [['ocena', 'desc'], ['reviews_count', 'desc']],
    ];

    private const DEFAULT_PER_PAGE = 12;

    /** Everything a product card needs. No description, no variant list. */
    public const LIST_COLUMNS = ['id', 'nazwa', 'kategoria', 'cena', 'ocena', 'reviews_count', 'rozmiar', 'kolor'];

    public const IMAGE_COLUMNS = 'images:id,product_id,image_path,order';

    private const CACHE_SECONDS = 300;

    private const VERSION_KEY = 'catalog:version';

    private const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

    public function search(array $filters): LengthAwarePaginator
    {
        $query = Product::query()
            ->select(self::LIST_COLUMNS)
            ->active()
            ->with(self::IMAGE_COLUMNS)
            ->withStockTotal();

        $this->applyFilters($query, $filters);

        foreach (self::SORTS[$filters['sort'] ?? 'newest'] as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        // The tie-break keeps a product from appearing on two pages.
        return $query->orderBy('id', 'desc')
            ->paginate($filters['per_page'] ?? self::DEFAULT_PER_PAGE)
            ->withQueryString();
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (filled($filters['q'] ?? null)) {
            LikeSearch::apply($query, ['nazwa', 'kategoria'], $filters['q']);
        }

        if (filled($filters['category'] ?? null)) {
            $query->where('kategoria', $filters['category']);
        }

        if (isset($filters['min_price'])) {
            $query->where('cena', '>=', $filters['min_price']);
        }

        if (isset($filters['max_price'])) {
            $query->where('cena', '<=', $filters['max_price']);
        }

        $size = $filters['size'] ?? null;
        $color = $filters['color'] ?? null;

        if (filled($size) || filled($color)) {
            // One variant has to match both, so a size and a color from different variants do not.
            $query->whereHas('variants', function (Builder $variants) use ($size, $color) {
                $variants->when(filled($size), fn ($q) => $q->where('size', $size))
                    ->when(filled($color), fn ($q) => $q->where('color', $color));
            });
        }
    }

    /** @return list<string> */
    public function categories(): array
    {
        return array_column($this->categoryCounts(), 'name');
    }

    public function filters(?string $category = null): array
    {
        $categories = $this->categoryCounts();

        // Only real categories reach the cache, so a request cannot fill it with made-up keys.
        if ($category !== null && !in_array($category, array_column($categories, 'name'), true)) {
            return ['categories' => $categories, 'sizes' => [], 'colors' => [], 'price' => ['min' => null, 'max' => null]];
        }

        return ['categories' => $categories] + $this->remember(
            'options:' . md5($category ?? ''),
            fn () => $this->options($category)
        );
    }

    /** @return list<array{name: string, count: int}> */
    private function categoryCounts(): array
    {
        return $this->remember('categories', fn () => Product::query()->active()->toBase()
            ->select('kategoria as name', DB::raw('count(*) as count'))
            ->groupBy('kategoria')
            ->orderBy('kategoria')
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count])
            ->all());
    }

    private function options(?string $category): array
    {
        $products = Product::query()->active()
            ->when($category !== null, fn ($q) => $q->where('kategoria', $category));

        $price = (clone $products)->toBase()
            ->select(DB::raw('min(cena) as min'), DB::raw('max(cena) as max'))
            ->first();

        return [
            'sizes' => $this->sortSizes($this->variantValues('size', $products)),
            'colors' => $this->variantValues('color', $products),
            'price' => [
                'min' => $price?->min === null ? null : (float) $price->min,
                'max' => $price?->max === null ? null : (float) $price->max,
            ],
        ];
    }

    /** @return list<string> */
    private function variantValues(string $column, Builder $products): array
    {
        return ProductVariant::query()
            ->whereIn('product_id', (clone $products)->select('id'))
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->all();
    }

    // Numbers first, then clothing sizes from small to large, then anything else.
    private function sortSizes(array $sizes): array
    {
        usort($sizes, fn (string $a, string $b) => $this->sizeRank($a) <=> $this->sizeRank($b) ?: strcmp($a, $b));

        return $sizes;
    }

    private function sizeRank(string $size): array
    {
        if (is_numeric($size)) {
            return [0, (float) $size];
        }

        $position = array_search(Str::upper($size), self::SIZE_ORDER, true);

        return $position === false ? [2, 0] : [1, $position];
    }

    private function remember(string $key, \Closure $build): array
    {
        $version = Cache::get(self::VERSION_KEY, '0');

        return Cache::remember("catalog:{$version}:{$key}", self::CACHE_SECONDS, $build);
    }

    /** Old entries are left to expire: the new version simply stops reading them. */
    public static function flush(): void
    {
        DB::afterCommit(fn () => Cache::forever(self::VERSION_KEY, (string) Str::uuid()));
    }
}
