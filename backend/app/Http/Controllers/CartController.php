<?php

namespace App\Http\Controllers;

use App\Models\CartItem;
use App\Models\Product;
use App\Services\CartPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CartController extends Controller
{
    private const MAX_QUANTITY = 99;

    public function __construct(private CartPricing $pricing)
    {
    }

    public function quote(Request $request)
    {
        $validated = $request->validate($this->itemRules() + [
            'coupon' => 'nullable|string|max:64',
            'delivery_method' => ['nullable', Rule::in(array_keys(config('shop.delivery_methods')))],
        ]);

        return response()->json($this->pricing->quote(
            $validated['items'],
            $validated['coupon'] ?? null,
            $validated['delivery_method'] ?? null
        ));
    }

    public function show(Request $request)
    {
        return response()->json($this->quoteFor($request));
    }

    public function update(Request $request)
    {
        $validated = $request->validate($this->itemRules());
        $customerId = $request->user()->id;

        // A cart merged from the browser can name products deleted since it was filled.
        $known = Product::whereIn('id', array_column($validated['items'], 'product_id'))->pluck('id')->all();
        $items = array_filter($validated['items'], fn (array $item) => in_array($item['product_id'], $known, true));

        DB::transaction(function () use ($customerId, $items) {
            CartItem::where('customer_id', $customerId)->delete();

            // insertOrIgnore: MySQL's unique index treats values differing only in case as equal.
            CartItem::insertOrIgnore($this->cartRows($customerId, $items));
        }, 3);

        return response()->json($this->quoteFor($request));
    }

    private function quoteFor(Request $request): array
    {
        $items = CartItem::where('customer_id', $request->user()->id)
            ->orderBy('id')
            ->get(['product_id', 'size', 'color', 'quantity'])
            ->toArray();

        return $this->pricing->quote($items);
    }

    /** Lines of one variant become one row, capped at the quantity an order accepts. */
    private function cartRows(int $customerId, array $items): array
    {
        $rows = [];
        $now = now();

        foreach ($items as $item) {
            $size = $item['size'] ?? '';
            $color = $item['color'] ?? '';
            $key = "{$item['product_id']}:{$size}:{$color}";

            $rows[$key] = [
                'customer_id' => $customerId,
                'product_id' => $item['product_id'],
                'size' => $size,
                'color' => $color,
                'quantity' => min(self::MAX_QUANTITY, ($rows[$key]['quantity'] ?? 0) + $item['quantity']),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return array_values($rows);
    }

    private function itemRules(): array
    {
        return [
            'items' => 'present|array|max:100',
            'items.*.product_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1|max:' . self::MAX_QUANTITY,
            'items.*.size' => 'nullable|string|max:255',
            'items.*.color' => 'nullable|string|max:255',
        ];
    }
}
