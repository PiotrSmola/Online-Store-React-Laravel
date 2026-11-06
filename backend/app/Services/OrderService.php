<?php

namespace App\Services;

use App\Models\CartItem;
use App\Models\Customer;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(private CartPricing $pricing)
    {
    }

    /**
     * Creates the order and takes the stock in one transaction.
     *
     * @param  array{
     *     items: list<array{product_id: int, quantity: int, size?: ?string, color?: ?string}>,
     *     payment_method: string,
     *     delivery_method: string,
     *     billing_address: array,
     *     shipping_address: array,
     *     payment_details: array,
     *     coupon_code?: ?string
     * }  $checkout
     *
     * @throws ValidationException with errors.cart when a line cannot be bought
     */
    public function place(Customer $customer, array $checkout): Order
    {
        return DB::transaction(function () use ($customer, $checkout) {
            $quote = $this->pricing->quote(
                $checkout['items'],
                $checkout['coupon_code'] ?? null,
                $checkout['delivery_method'],
                lockVariants: true
            );

            $problems = array_values(array_filter(array_column($quote['lines'], 'error')));

            if ($problems) {
                throw ValidationException::withMessages(['cart' => $problems]);
            }

            foreach ($quote['lines'] as $line) {
                $this->takeStock($line);
            }

            $order = Order::create([
                'customer_id' => $customer->id,
                'subtotal_amount' => $quote['subtotal'],
                'discount_amount' => $quote['discount'],
                'total_amount' => $quote['total'],
                'status' => 'pending',
                'payment_method' => $checkout['payment_method'],
                'delivery_method' => $checkout['delivery_method'],
                'delivery_price' => $quote['delivery_price'],
                'billing_address' => $checkout['billing_address'],
                'shipping_address' => $checkout['shipping_address'],
                'payment_details' => $checkout['payment_details'],
                'order_date' => now(),
            ]);

            foreach ($quote['lines'] as $line) {
                $order->items()->create([
                    'product_id' => $line['product']->id,
                    'quantity' => $line['quantity'],
                    'price' => $line['unit_price'],
                    'selected_size' => $line['size'] === '' ? null : $line['size'],
                    'selected_color' => $line['color'] === '' ? null : $line['color'],
                ]);
            }

            $this->recordEvent($order, 'pending');
            CartItem::where('customer_id', $customer->id)->delete();

            Log::info('Order created', ['order_id' => $order->id]);

            return $order;
        }, 3);
    }

    /**
     * Moves the order along STATUS_TRANSITIONS. Decided on the row as it is under the lock,
     * so two requests cannot both cancel an order and return its stock twice.
     *
     * @param  ?string  $requiredStatus  Refuse unless the order is in this status at that moment.
     *
     * @throws ValidationException with errors.status when the change is not allowed
     */
    public function changeStatus(Order $order, string $status, ?string $note = null, ?string $requiredStatus = null): Order
    {
        return DB::transaction(function () use ($order, $status, $note, $requiredStatus) {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($requiredStatus !== null && $locked->status !== $requiredStatus) {
                throw ValidationException::withMessages([
                    'status' => ['Tej operacji nie można wykonać dla zamówienia o statusie: ' . $locked->status_label],
                ]);
            }

            if (!in_array($status, $locked->next_statuses, true)) {
                throw ValidationException::withMessages([
                    'status' => ["Nie można zmienić statusu z „{$locked->status_label}” na „" . (Order::STATUS_LABELS[$status] ?? $status) . '”'],
                ]);
            }

            if ($status === 'cancelled') {
                $this->returnStock($locked);

                if ($locked->payment_status === 'paid') {
                    $locked->payment_status = 'refunded';
                }
            }

            $locked->status = $status;
            $locked->save();
            $this->recordEvent($locked, $status, $note);

            return $locked;
        }, 3);
    }

    // The WHERE repeats the check the lock already made, so stock cannot go below zero
    // even where FOR UPDATE does nothing: sqlite ignores it.
    private function takeStock(array $line): void
    {
        $taken = ProductVariant::query()
            ->whereKey($line['variant_id'])
            ->where('stock', '>=', $line['quantity'])
            ->decrement('stock', $line['quantity']);

        if (!$taken) {
            throw ValidationException::withMessages([
                'cart' => ["Produkt „{$line['product']->nazwa}” został właśnie wykupiony"],
            ]);
        }
    }

    private function returnStock(Order $order): void
    {
        $items = $order->items()->get(['product_id', 'quantity', 'selected_size', 'selected_color']);

        $variants = ProductVariant::query()
            ->whereIn('product_id', $items->pluck('product_id')->unique())
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($items as $item) {
            $variant = $variants->first(fn (ProductVariant $variant) => (int) $variant->product_id === (int) $item->product_id
                && $variant->size === ($item->selected_size ?? '')
                && $variant->color === ($item->selected_color ?? ''));

            // An admin may have removed the variant since: there is nothing to return it to.
            $variant?->newQuery()->whereKey($variant->id)->increment('stock', $item->quantity);
        }
    }

    private function recordEvent(Order $order, string $status, ?string $note = null): void
    {
        $order->statusEvents()->create(['status' => $status, 'note' => $note]);
    }
}
