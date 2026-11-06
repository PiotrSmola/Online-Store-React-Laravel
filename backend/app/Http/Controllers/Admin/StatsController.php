<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    private const LOW_STOCK_BELOW = 3;

    private const LOW_STOCK_LIMIT = 50;

    public function __invoke()
    {
        $byStatus = Order::query()->toBase()
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $lowStock = ProductVariant::query()->where('stock', '<', self::LOW_STOCK_BELOW);

        return response()->json([
            'revenue' => round((float) Order::query()->where('payment_status', 'paid')->sum('total_amount'), 2),
            'orders_count' => (int) $byStatus->sum(),
            'orders_by_status' => collect(array_keys(Order::STATUS_LABELS))
                ->mapWithKeys(fn (string $status) => [$status => (int) ($byStatus[$status] ?? 0)]),
            'low_stock_count' => (clone $lowStock)->count(),
            'low_stock' => $lowStock
                ->with('product:id,nazwa')
                ->orderBy('stock')
                ->orderBy('id')
                ->limit(self::LOW_STOCK_LIMIT)
                ->get(['id', 'product_id', 'size', 'color', 'stock']),
        ]);
    }
}
