@extends('emails.layout')

@section('title', 'Potwierdź zapis do newslettera')

@section('content')
    <p>Ktoś podał ten adres, aby otrzymywać nasz newsletter. Zapis zacznie działać dopiero po potwierdzeniu.</p>
    <p>
        <a href="{{ $confirmUrl }}" style="display: inline-block; padding: 10px 18px; background: #1c1917; color: #ffffff; text-decoration: none; border-radius: 6px;">Potwierdzam zapis</a>
    </p>
    <p>Jeśli to nie Ty, zignoruj tę wiadomość. Bez potwierdzenia nie wyślemy nic więcej.</p>
    <p style="font-size: 13px; color: #78716c;"><a href="{{ $unsubscribeUrl }}" style="color: #78716c;">Wypisz się z newslettera</a></p>
@endsection
