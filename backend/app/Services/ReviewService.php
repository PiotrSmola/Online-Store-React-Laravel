<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use Illuminate\Support\Facades\DB;

class ReviewService
{
    /** Buyers with an order that was not cancelled. */
    public function canReview(?Customer $customer, Product $product): bool
    {
        if (!$customer) {
            return false;
        }

        return OrderItem::query()
            ->where('product_id', $product->id)
            ->whereHas('order', fn ($orders) => $orders
                ->where('customer_id', $customer->id)
                ->where('status', '!=', 'cancelled'))
            ->exists();
    }

    /** One review per customer and product: writing again replaces the earlier one. */
    public function save(Customer $customer, Product $product, int $rating, ?string $comment): Review
    {
        return $this->underProductLock($product, fn () => Review::updateOrCreate(
            ['product_id' => $product->id, 'customer_id' => $customer->id],
            ['rating' => $rating, 'comment' => $comment]
        ));
    }

    public function delete(Review $review): void
    {
        $this->underProductLock($review->product, fn () => $review->delete());
    }

    // The lock makes two reviews of one product recalculate one after the other,
    // so the later count sees the earlier review.
    private function underProductLock(Product $product, callable $change): mixed
    {
        return DB::transaction(function () use ($product, $change) {
            Product::query()->whereKey($product->id)->lockForUpdate()->first();

            $result = $change();
            $this->recalculate($product);

            return $result;
        }, 3);
    }

    public function recalculate(Product $product): void
    {
        $totals = Review::query()->where('product_id', $product->id)->toBase()
            ->select(DB::raw('count(*) as total'), DB::raw('avg(rating) as average'))
            ->first();

        // Through the query builder: the rating is not part of the cached catalog filters.
        Product::query()->whereKey($product->id)->update([
            'reviews_count' => (int) $totals->total,
            'ocena' => round((float) $totals->average, 1),
        ]);
    }
}
