<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\CatalogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    private const RELATED_LIMIT = 4;

    public function __construct(private CatalogService $catalog)
    {
    }

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => 'nullable|string|max:100',
            'category' => 'nullable|string|max:255',
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0',
            'size' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'sort' => ['nullable', Rule::in(array_keys(CatalogService::SORTS))],
            'per_page' => 'nullable|integer|min:1|max:48',
            'page' => 'nullable|integer|min:1',
        ]);

        return response()->json($this->catalog->search($filters));
    }

    public function show(Product $product)
    {
        abort_unless($product->is_active, 404);

        $product->load([CatalogService::IMAGE_COLUMNS, 'variants:id,product_id,size,color,stock']);
        $product->setAttribute('stock_total', $product->variants->sum('stock'));

        $related = Product::query()
            ->select(CatalogService::LIST_COLUMNS)
            ->active()
            ->where('kategoria', $product->kategoria)
            ->whereKeyNot($product->id)
            ->with(CatalogService::IMAGE_COLUMNS)
            ->withStockTotal()
            ->orderBy('ocena', 'desc')
            ->orderBy('id', 'desc')
            ->limit(self::RELATED_LIMIT)
            ->get();

        return response()->json($product->toArray() + ['related' => $related]);
    }

    public function filters(Request $request)
    {
        $validated = $request->validate(['category' => 'nullable|string|max:255']);

        return response()->json($this->catalog->filters($validated['category'] ?? null));
    }

    public function categories()
    {
        return response()->json($this->catalog->categories());
    }
}
