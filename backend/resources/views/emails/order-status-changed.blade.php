@extends('emails.layout')

@section('title', 'Zmiana statusu zamówienia')

@section('content')
    <p>Zamówienie <strong>{{ $order->order_number }}</strong> ma nowy status: <strong>{{ $statusLabel }}</strong>.</p>

    @if ($note)
        <p>{{ $note }}</p>
    @endif

    <p>Płatność: {{ $paymentStatusLabel }}</p>
@endsection
