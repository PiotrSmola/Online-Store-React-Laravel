<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\WishlistItem;
use App\Services\CatalogService;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    private const PER_PAGE = 48;

    public function index(Request $request)
    {
        $products = Product::query()
            ->select(CatalogService::LIST_COLUMNS)
            ->active()
            ->whereIn('id', WishlistItem::where('customer_id', $request->user()->id)->select('product_id'))
            ->with(CatalogService::IMAGE_COLUMNS)
            ->withStockTotal()
            ->orderBy('id', 'desc')
            ->paginate(self::PER_PAGE);

        return response()->json($products);
    }

    public function store(Request $request, Product $product)
    {
        abort_unless($product->is_active, 404);

        // Two taps at once cannot fail: the unique index decides and the loser reads the row.
        WishlistItem::createOrFirst(['customer_id' => $request->user()->id, 'product_id' => $product->id]);

        return response()->json(['in_wishlist' => true]);
    }

    public function destroy(Request $request, Product $product)
    {
        WishlistItem::where('customer_id', $request->user()->id)
            ->where('product_id', $product->id)
            ->delete();

        return response()->json(['in_wishlist' => false]);
    }
}
