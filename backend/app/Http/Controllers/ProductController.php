<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::with('images')->get();
        return response()->json($products);
    }

    public function show(Product $product)
    {
        $product->load('images');
        return response()->json($product);
    }

    public function byCategory($category)
    {
        $products = Product::with('images')
            ->where('kategoria', $category)
            ->get();

        return response()->json($products);
    }

    public function categories()
    {
        $categories = Product::distinct()->pluck('kategoria');
        return response()->json($categories);
    }
}
