<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8">
    <title>Faktura {{ $number }}</title>
    <style>
        body { font-family: "DejaVu Sans", sans-serif; font-size: 11px; color: #1c1917; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        table { width: 100%; border-collapse: collapse; }
        .parties td { width: 50%; vertical-align: top; padding-top: 16px; }
        .lines { margin-top: 20px; }
        .lines th, .lines td { border-bottom: 1px solid #d6d3d1; padding: 5px 4px; text-align: right; }
        .lines th:first-child, .lines td:first-child { text-align: left; }
        .lines tfoot td { font-weight: bold; border-bottom: none; }
        .muted { color: #78716c; }
    </style>
</head>
<body>
    @php($billing = $order->billing_address)
    @php($pln = fn ($amount) => number_format((float) $amount, 2, ',', ' '))

    <h1>Faktura VAT {{ $number }}</h1>
    <div class="muted">
        Data wystawienia: {{ $order->paid_at?->format('d.m.Y') }}<br>
        Zamówienie: {{ $order->order_number }} z dnia {{ $order->order_date?->format('d.m.Y') }}<br>
        Płatność: {{ $order->payment_method_label }}
        @if ($order->payment_status === 'refunded')
            <br><strong>Zamówienie anulowane, płatność została zwrócona.</strong>
        @endif
    </div>

    <table class="parties">
        <tr>
            <td>
                <strong>Sprzedawca</strong><br>
                {{ $seller['name'] }}<br>
                {{ $seller['address'] }}<br>
                NIP: {{ $seller['nip'] }}<br>
                Konto: {{ $seller['bank_account'] }}
            </td>
            <td>
                <strong>Nabywca</strong><br>
                @if ($billing['company_name'] ?? null)
                    {{ $billing['company_name'] }}<br>
                @endif
                {{ $billing['first_name'] ?? '' }} {{ $billing['last_name'] ?? '' }}<br>
                {{ $billing['address'] ?? '' }}<br>
                {{ $billing['postal_code'] ?? '' }} {{ $billing['city'] ?? '' }}<br>
                @if ($billing['nip'] ?? $order->customer?->nip)
                    NIP: {{ $billing['nip'] ?? $order->customer?->nip }}
                @endif
            </td>
        </tr>
    </table>

    <table class="lines">
        <thead>
            <tr>
                <th>Nazwa</th>
                <th>Ilość</th>
                <th>Netto [zł]</th>
                <th>VAT {{ $vatRate }}% [zł]</th>
                <th>Brutto [zł]</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $row)
                <tr>
                    <td>{{ $row['name'] }}</td>
                    <td>{{ $row['quantity'] }}</td>
                    <td>{{ $pln($row['net']) }}</td>
                    <td>{{ $pln($row['vat']) }}</td>
                    <td>{{ $pln($row['gross']) }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr>
                <td>Razem</td>
                <td></td>
                <td>{{ $pln($totals['net']) }}</td>
                <td>{{ $pln($totals['vat']) }}</td>
                <td>{{ $pln($totals['gross']) }}</td>
            </tr>
        </tfoot>
    </table>
</body>
</html>
