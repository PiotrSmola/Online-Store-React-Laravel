@extends('emails.layout')

@section('title', 'Zmiana hasła')

@section('content')
    <p>Otrzymaliśmy prośbę o zmianę hasła do Twojego konta.</p>
    <p>
        <a href="{{ $url }}" style="display: inline-block; padding: 10px 18px; background: #1c1917; color: #ffffff; text-decoration: none; border-radius: 6px;">Ustaw nowe hasło</a>
    </p>
    <p>Link jest ważny przez {{ $minutes }} minut i można go użyć tylko raz.</p>
    <p>Jeśli to nie Ty, zignoruj tę wiadomość. Twoje hasło pozostanie bez zmian.</p>
@endsection
