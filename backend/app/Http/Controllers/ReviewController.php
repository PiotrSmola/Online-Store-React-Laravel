<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\ReviewService;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function __construct(private ReviewService $reviews)
    {
    }

    public function store(Request $request, Product $product)
    {
        abort_unless($product->is_active, 404);

        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:2000',
        ]);

        $customer = $request->user();

        if (!$this->reviews->canReview($customer, $product)) {
            return response()->json(['message' => 'Opinię może wystawić tylko osoba, która kupiła ten produkt.'], 403);
        }

        $review = $this->reviews->save($customer, $product, $validated['rating'], $validated['comment'] ?? null);

        return response()->json($review->load('customer:id,first_name,last_name')->toPublicArray());
    }
}
