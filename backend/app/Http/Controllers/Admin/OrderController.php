<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\InvoiceService;
use App\Services\OrderService;
use App\Support\LikeSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    private const PER_PAGE = 20;

    private const LIST_COLUMNS = [
        'id',
        'order_number',
        'customer_id',
        'status',
        'payment_status',
        'payment_method',
        'delivery_method',
        'total_amount',
        'order_date',
    ];

    public function __construct(private OrderService $orders)
    {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(Order::STATUS_LABELS))],
            'q' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $query = Order::query()
            ->select(self::LIST_COLUMNS)
            ->with('customer:id,email,first_name,last_name')
            ->withCount('items')
            ->orderBy('order_date', 'desc')
            ->orderBy('id', 'desc');

        if (filled($validated['status'] ?? null)) {
            $query->where('status', $validated['status']);
        }

        if (filled($validated['q'] ?? null)) {
            $term = $validated['q'];

            $query->where(function (Builder $orders) use ($term) {
                LikeSearch::apply($orders, ['order_number'], $term);

                $orders->orWhereHas('customer', fn (Builder $customers) => LikeSearch::apply(
                    $customers,
                    ['email', 'first_name', 'last_name'],
                    $term
                ));
            });
        }

        return response()->json($query->paginate(self::PER_PAGE)->withQueryString());
    }

    public function show(Order $order)
    {
        return response()->json($order->load([...Order::DETAILS, 'customer']));
    }

    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_keys(Order::STATUS_LABELS))],
            'note' => 'nullable|string|max:255',
        ]);

        $order = $this->orders->changeStatus($order, $validated['status'], $validated['note'] ?? null);

        return response()->json($order->load([...Order::DETAILS, 'customer']));
    }

    public function markPaid(Order $order)
    {
        return response()->json($this->orders->markPaid($order)->load([...Order::DETAILS, 'customer']));
    }

    public function invoice(Order $order, InvoiceService $invoices)
    {
        return $invoices->download($order);
    }
}
