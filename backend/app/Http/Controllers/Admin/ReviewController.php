<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Services\ReviewService;

class ReviewController extends Controller
{
    public function __construct(private ReviewService $reviews)
    {
    }

    public function destroy(Review $review)
    {
        $this->reviews->delete($review);

        return response()->json(['message' => 'Opinia została usunięta.']);
    }
}
