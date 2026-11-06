@extends('emails.layout')

@section('title', 'Zmiana statusu zamówienia')

@section('content')
    <p>Zamówienie <strong>{{ $order->order_number }}</strong> ma nowy status: <strong>{{ $order->status_label }}</strong>.</p>

    @if ($note)
        <p>{{ $note }}</p>
    @endif

    <p>Płatność: {{ $order->payment_status_label }}</p>
@endsection
