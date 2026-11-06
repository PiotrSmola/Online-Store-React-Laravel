@extends('emails.layout')

@section('title', 'Dziękujemy za zamówienie')

@section('content')
    @php($pln = fn ($amount) => number_format((float) $amount, 2, ',', ' ') . ' zł')

    <p>Zamówienie <strong>{{ $order->order_number }}</strong> zostało przyjęte.</p>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        @foreach ($order->items as $item)
            <tr>
                <td style="padding: 6px 0; border-bottom: 1px solid #e7e5e4;">
                    {{ $item->product?->nazwa }}
                    @if ($item->selected_size || $item->selected_color)
                        <br><span style="color: #78716c;">{{ collect([$item->selected_size, $item->selected_color])->filter()->join(', ') }}</span>
                    @endif
                </td>
                <td style="padding: 6px 0; border-bottom: 1px solid #e7e5e4; text-align: right; white-space: nowrap;">{{ $item->quantity }} × {{ $pln($item->price) }}</td>
            </tr>
        @endforeach
    </table>

    <p style="margin: 16px 0 0; font-size: 14px;">
        Produkty: {{ $pln($order->subtotal_amount) }}<br>
        @if ((float) $order->discount_amount > 0)
            Rabat ({{ $order->coupon_code }}): -{{ $pln($order->discount_amount) }}<br>
        @endif
        Dostawa ({{ $order->delivery_method_label }}): {{ $pln($order->delivery_price) }}<br>
        <strong>Do zapłaty: {{ $pln($order->total_amount) }}</strong>
    </p>

    <p>Płatność: {{ $order->payment_method_label }}</p>

    @if ($order->payment_details['instructions'] ?? null)
        <p>{{ $order->payment_details['instructions'] }}</p>
    @endif
@endsection
