<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\ProductImageService;
use Illuminate\Http\Request;

class ProductImageController extends Controller
{
    public function __construct(private ProductImageService $images)
    {
    }

    public function store(Request $request, Product $product)
    {
        $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $image = $this->images->store($product, $request->file('image'));

        return response()->json($image->only(['id', 'product_id', 'image_path', 'order']), 201);
    }

    public function destroy(Product $product, ProductImage $image)
    {
        $file = $image->image_path;
        $image->delete();
        $this->images->deleteFiles($file);

        return response()->json(['message' => 'Zdjęcie zostało usunięte.']);
    }
}
