<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Review;
use App\Services\CatalogService;
use App\Services\ReviewService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    private const RELATED_LIMIT = 4;

    private const REVIEWS_LIMIT = 20;

    public function __construct(private CatalogService $catalog, private ReviewService $reviews)
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

    public function show(Request $request, Product $product)
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

        $reviews = $product->reviews()
            ->with('customer:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc')
            ->limit(self::REVIEWS_LIMIT)
            ->get()
            ->map(fn (Review $review) => $review->toPublicArray());

        return response()->json($product->toArray() + [
            'reviews' => $reviews,
            'related' => $related,
            'can_review' => $this->reviews->canReview($request->user('sanctum'), $product),
        ]);
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
