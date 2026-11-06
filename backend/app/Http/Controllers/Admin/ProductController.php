<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\CatalogService;
use App\Services\ProductAdminService;
use App\Support\LikeSearch;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    private const PER_PAGE = 20;

    public function __construct(private ProductAdminService $products)
    {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $query = Product::query()
            ->select([...CatalogService::LIST_COLUMNS, 'is_active'])
            ->with(CatalogService::IMAGE_COLUMNS)
            ->withStockTotal()
            ->orderBy('id', 'desc');

        if (filled($validated['q'] ?? null)) {
            LikeSearch::apply($query, ['nazwa', 'kategoria'], $validated['q']);
        }

        return response()->json($query->paginate(self::PER_PAGE)->withQueryString());
    }

    public function show(Product $product)
    {
        return response()->json($this->withDetails($product));
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        return response()->json($this->withDetails($this->products->create($validated)->refresh()), 201);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $this->validated($request, $product);

        return response()->json($this->withDetails($this->products->update($product, $validated)));
    }

    public function destroy(Product $product)
    {
        $deleted = $this->products->delete($product);

        return response()->json([
            'deleted' => $deleted,
            'message' => $deleted
                ? 'Produkt został usunięty.'
                : 'Produkt ma zamówienia, więc został ukryty zamiast usunięcia.',
        ]);
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        $required = $product ? 'sometimes|required' : 'required';

        $validated = $request->validate([
            'nazwa' => "{$required}|string|max:255",
            'kategoria' => "{$required}|string|max:255",
            'cena' => "{$required}|numeric|min:0|max:99999999.99",
            'sale_price' => 'sometimes|nullable|numeric|min:0.01|max:99999999.99',
            'opis' => "{$required}|string|max:20000",
            'is_active' => 'sometimes|boolean',
            'is_new' => 'sometimes|boolean',
            'variants' => "{$required}|array|min:1|max:500",
            'variants.*.size' => 'nullable|string|max:255',
            'variants.*.color' => 'nullable|string|max:255',
            'variants.*.stock' => 'required|integer|min:0|max:1000000',
        ]);

        $this->rejectDuplicates($validated['variants'] ?? []);
        $this->rejectSaleAboveRegularPrice($validated, $product);

        return $validated;
    }

    // Checked against the prices the product will have afterwards, so lowering cena
    // alone cannot leave an older sale_price above it.
    private function rejectSaleAboveRegularPrice(array $validated, ?Product $product): void
    {
        $price = $validated['cena'] ?? $product?->cena;
        $sale = array_key_exists('sale_price', $validated) ? $validated['sale_price'] : $product?->sale_price;

        if ($sale !== null && round((float) $sale, 2) >= round((float) $price, 2)) {
            throw ValidationException::withMessages([
                'sale_price' => ['Cena promocyjna musi być niższa od ceny regularnej.'],
            ]);
        }
    }

    // Compared without case because MySQL's unique index would treat these as one row.
    private function rejectDuplicates(array $variants): void
    {
        $seen = [];

        foreach ($variants as $variant) {
            $key = mb_strtolower(trim((string) ($variant['size'] ?? '')) . '|' . trim((string) ($variant['color'] ?? '')));

            if (isset($seen[$key])) {
                throw ValidationException::withMessages(['variants' => ['Warianty nie mogą się powtarzać.']]);
            }

            $seen[$key] = true;
        }
    }

    private function withDetails(Product $product): Product
    {
        $product->load([CatalogService::IMAGE_COLUMNS, 'variants:id,product_id,size,color,stock']);
        $product->setAttribute('stock_total', $product->variants->sum('stock'));

        return $product;
    }
}
