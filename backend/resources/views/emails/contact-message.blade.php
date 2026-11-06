@extends('emails.layout')

@section('title', 'Nowa wiadomość ze strony')

@section('content')
    <p>
        Od: {{ $contact->name }} ({{ $contact->email }})<br>
        Temat: {{ $contact->subject }}
    </p>
    <p style="white-space: pre-wrap;">{{ $contact->message }}</p>
@endsection
