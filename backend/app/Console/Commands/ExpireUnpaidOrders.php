<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderService;
use App\Support\SafeExceptionContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ExpireUnpaidOrders extends Command
{
    protected $signature = 'orders:expire-unpaid';

    protected $description = 'Cancel card and transfer orders left unpaid for too long and return their stock';

    private const NOTE = 'Anulowane automatycznie: brak płatności w terminie';

    public function handle(OrderService $orders): int
    {
        $cancelled = 0;

        // Cash waits for store pickup. Orders from before stock tracking hold no stock to free.
        Order::query()
            ->select('id')
            ->where('status', 'pending')
            ->whereIn('payment_method', ['card', 'transfer'])
            ->whereIn('payment_status', ['unpaid', 'failed'])
            ->where('stock_deducted', true)
            ->where('order_date', '<', now()->subHours(config('shop.unpaid_order_hours')))
            ->lazyById()
            ->each(function (Order $order) use ($orders, &$cancelled) {
                try {
                    $orders->changeStatus($order, 'cancelled', self::NOTE, requiredStatus: 'pending');
                    $cancelled++;
                } catch (ValidationException) {
                    // Paid or moved on since the query above: the lock decided, nothing to do.
                } catch (\Throwable $e) {
                    Log::error('Unpaid order could not be cancelled', ['order_id' => $order->id] + SafeExceptionContext::of($e));
                }
            });

        $this->info("Anulowano nieopłacone zamówienia: {$cancelled}.");

        return self::SUCCESS;
    }
}
