<?php

namespace App\Services;

use App\Models\Order;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    private const NUMBER_ATTEMPTS = 5;

    public function download(Order $order): Response
    {
        // An issued invoice stays available after a refund: it is a record of the sale.
        // A refunded order that never had one does not get one now.
        $issued = $order->payment_status === 'refunded' && $order->invoice_number !== null;

        if ($order->payment_status !== 'paid' && !$issued) {
            throw new HttpResponseException(response()->json([
                'message' => 'Faktura jest dostępna po opłaceniu zamówienia.',
            ], 409));
        }

        $number = $this->ensureNumber($order);
        $order->loadMissing(['items', 'customer:id,nip']);

        $pdf = Pdf::loadView('invoices.order', [
            'number' => $number,
            'order' => $order,
            'seller' => config('shop.seller'),
            'vatRate' => config('shop.vat_rate'),
            ...$this->amounts($order),
        ])->setPaper('a4')->setOption('isFontSubsettingEnabled', true);

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="faktura-' . str_replace('/', '-', $number) . '.pdf"',
        ]);
    }

    /**
     * Gives the order its number the first time an invoice is asked for. Two orders can read
     * the same highest sequence at once: the unique index refuses the loser, who takes the next.
     */
    public function ensureNumber(Order $order): string
    {
        for ($attempt = 1; ; $attempt++) {
            try {
                return DB::transaction(function () use ($order) {
                    $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

                    if ($locked->invoice_number === null) {
                        $this->assignNumber($locked);
                        $locked->save();
                    }

                    return $order->invoice_number = $locked->invoice_number;
                }, 3);
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= self::NUMBER_ATTEMPTS) {
                    throw $e;
                }
            }
        }
    }

    // The sequence is kept as a number: in text order 9999 comes after 10000.
    private function assignNumber(Order $order): void
    {
        $prefix = ($order->paid_at ?? now())->format('\F\V/Y/m/');
        $next = (int) Order::query()->where('invoice_number', 'like', $prefix . '%')->max('invoice_sequence') + 1;

        $order->invoice_sequence = $next;
        $order->invoice_number = $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Prices are gross, so net and VAT are worked out backwards per row and then added up:
     * the rows always sum to the totals, and the gross total is the amount that was paid.
     *
     * @return array{rows: list<array>, totals: array{net: float, vat: float, gross: float}}
     */
    public function amounts(Order $order): array
    {
        $rows = [];

        foreach ($order->items as $item) {
            $options = array_filter([$item->selected_size, $item->selected_color]);

            $rows[] = $this->row(
                $item->product_name . ($options ? ' (' . implode(', ', $options) . ')' : ''),
                $item->quantity,
                $this->grosze($item->price) * $item->quantity
            );
        }

        if ((float) $order->discount_amount > 0) {
            $rows[] = $this->row("Rabat ({$order->coupon_code})", 1, -$this->grosze($order->discount_amount));
        }

        if ((float) $order->delivery_price > 0) {
            $rows[] = $this->row("Dostawa: {$order->delivery_method_label}", 1, $this->grosze($order->delivery_price));
        }

        $sum = fn (string $key) => array_sum(array_column($rows, $key));

        return [
            'rows' => array_map(fn (array $row) => [
                'name' => $row['name'],
                'quantity' => $row['quantity'],
                'net' => $row['net'] / 100,
                'vat' => $row['vat'] / 100,
                'gross' => $row['gross'] / 100,
            ], $rows),
            'totals' => [
                'net' => $sum('net') / 100,
                'vat' => $sum('vat') / 100,
                'gross' => $sum('gross') / 100,
            ],
        ];
    }

    private function row(string $name, int $quantity, int $gross): array
    {
        $net = (int) round($gross / (1 + config('shop.vat_rate') / 100));

        return ['name' => $name, 'quantity' => $quantity, 'net' => $net, 'vat' => $gross - $net, 'gross' => $gross];
    }

    private function grosze(string $amount): int
    {
        return (int) round((float) $amount * 100);
    }
}
