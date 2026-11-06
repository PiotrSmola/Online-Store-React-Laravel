<?php

namespace App\Services;

use App\Mail\OrderPlaced;
use App\Mail\OrderStatusChanged;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Support\QueuedMail;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class OrderService
{
    /** The simulator's test card: any card ending in these digits is declined. */
    private const DECLINED_CARD_LAST_FOUR = '0002';

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
     *     coupon_code?: ?string,
     *     client_ip_hash?: ?string
     * }  $checkout
     *
     * @throws ValidationException with errors.cart when a line cannot be bought,
     *                             errors.coupon_code when the coupon no longer applies
     */
    public function place(Customer $customer, array $checkout): Order
    {
        return DB::transaction(function () use ($customer, $checkout) {
            $quote = $this->pricing->quote(
                $checkout['items'],
                $checkout['coupon_code'] ?? null,
                $checkout['delivery_method'],
                lock: true
            );

            $problems = array_values(array_filter(array_column($quote['lines'], 'error')));

            if ($problems) {
                throw ValidationException::withMessages(['cart' => $problems]);
            }

            if ($quote['coupon_error']) {
                throw ValidationException::withMessages(['coupon_code' => [$quote['coupon_error']]]);
            }

            foreach ($quote['lines'] as $line) {
                $this->takeStock($line);
            }

            $couponCode = $quote['coupon']['code'] ?? null;

            if ($couponCode && !Coupon::takeUse($couponCode)) {
                throw ValidationException::withMessages(['coupon_code' => ['Ten kod rabatowy został już wykorzystany']]);
            }

            $order = new Order([
                'customer_id' => $customer->id,
                'subtotal_amount' => $quote['subtotal'],
                'discount_amount' => $quote['discount'],
                'coupon_code' => $couponCode,
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
            $order->stock_deducted = true;
            $order->client_ip_hash = $checkout['client_ip_hash'] ?? null;
            $order->save();

            foreach ($quote['lines'] as $line) {
                $order->items()->create([
                    'product_id' => $line['product']->id,
                    'product_name' => $line['product']->nazwa,
                    'quantity' => $line['quantity'],
                    'price' => $line['unit_price'],
                    'selected_size' => $line['size'] === '' ? null : $line['size'],
                    'selected_color' => $line['color'] === '' ? null : $line['color'],
                ]);
            }

            $this->recordEvent($order, 'pending');
            CartItem::where('customer_id', $customer->id)->delete();
            $this->queueMail($order, new OrderPlaced($order));

            Log::info('Order created', ['order_id' => $order->id]);

            return $order;
        }, 3);
    }

    /**
     * Every unpaid order holds stock, so a limit on how many can be open stops one visitor
     * from buying a product out without paying. Call it inside the placing transaction.
     *
     * @throws HttpResponseException with a 429
     */
    public function ensureRoomForOpenOrder(Customer $customer, string $clientIpHash): void
    {
        // Makes a customer's own parallel orders count each other.
        Customer::query()->whereKey($customer->id)->lockForUpdate()->first();

        $open = Order::query()->where('status', 'pending')->whereIn('payment_status', ['unpaid', 'failed']);

        $limits = config('shop.open_orders');

        if ((clone $open)->where('customer_id', $customer->id)->count() >= $limits['per_customer']
            || (clone $open)->where('client_ip_hash', $clientIpHash)->count() >= $limits['per_ip']) {
            throw new HttpResponseException(response()->json([
                'message' => 'Masz zbyt wiele nieopłaconych zamówień. Opłać lub anuluj wcześniejsze, aby złożyć kolejne.',
            ], 429));
        }
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
                // Orders from before stock tracking took nothing, so they have nothing to give back.
                if ($locked->stock_deducted) {
                    $this->returnStock($locked);
                }

                if ($locked->coupon_code) {
                    Coupon::releaseUse($locked->coupon_code);
                }

                if ($locked->payment_status === 'paid') {
                    $locked->payment_status = 'refunded';
                }
            }

            $locked->status = $status;
            $locked->save();
            $this->recordEvent($locked, $status, $note);
            $this->queueStatusMail($locked, $note);

            return $locked;
        }, 3);
    }

    /**
     * Simulated card payment. Only the last four digits ever reach the server.
     * Decided under the row lock, so an order can be paid only once however many requests race.
     *
     * @return Order with payment_status paid, or failed when the card was declined
     */
    public function pay(Order $order, string $cardLastFour): Order
    {
        return DB::transaction(function () use ($order, $cardLastFour) {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($locked->payment_method !== 'card') {
                throw ValidationException::withMessages([
                    'payment' => ['To zamówienie nie jest opłacane kartą.'],
                ]);
            }

            $this->ensurePayable($locked);

            if (!$locked->stock_deducted) {
                throw new HttpResponseException(response()->json(['message' => 'Tego zamówienia nie można opłacić online.'], 409));
            }

            if ($cardLastFour === self::DECLINED_CARD_LAST_FOUR) {
                $locked->payment_status = 'failed';
                $locked->save();

                return $locked;
            }

            $locked->payment_details = array_merge($locked->payment_details, ['card_last_four' => $cardLastFour]);

            return $this->settle($locked, 'Płatność kartą przyjęta');
        }, 3);
    }

    /** Transfers and cash are confirmed by an admin; cards pay through pay(). */
    public function markPaid(Order $order): Order
    {
        return DB::transaction(function () use ($order) {
            $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

            if ($locked->payment_method === 'card') {
                throw ValidationException::withMessages([
                    'payment' => ['Płatność kartą opłaca klient.'],
                ]);
            }

            $this->ensurePayable($locked);

            return $this->settle($locked, 'Płatność potwierdzona przez sklep');
        }, 3);
    }

    private function ensurePayable(Order $order): void
    {
        $problem = match (true) {
            $order->status === 'cancelled' => 'To zamówienie zostało anulowane.',
            $order->payment_status === 'paid' => 'To zamówienie jest już opłacone.',
            $order->payment_status === 'refunded' => 'Płatność za to zamówienie została zwrócona.',
            default => null,
        };

        if ($problem) {
            throw new HttpResponseException(response()->json(['message' => $problem], 409));
        }
    }

    private function settle(Order $order, string $note): Order
    {
        $order->payment_status = 'paid';
        $order->paid_at = now();

        // An admin may already have moved the order on. Payment never moves it back.
        if ($order->status === 'pending') {
            $order->status = 'processing';
        }

        $order->save();
        $this->recordEvent($order, $order->status, $note);
        $this->queueStatusMail($order, $note);

        Log::info('Order paid', ['order_id' => $order->id]);

        return $order;
    }

    private function queueStatusMail(Order $order, ?string $note): void
    {
        $this->queueMail($order, new OrderStatusChanged(
            $order,
            $order->status,
            $order->status_label,
            $order->payment_status_label,
            $note
        ));
    }

    // After the commit, so a rolled back order sends nothing.
    private function queueMail(Order $order, Mailable $mail): void
    {
        DB::afterCommit(fn () => QueuedMail::send($order->customer->email, $mail, ['order_id' => $order->id]));
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
