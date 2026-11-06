<?php

return [

    /*
    | Delivery methods with their prices in PLN. The server is the only source of
    | prices: the frontend shows what POST /api/cart/quote returns.
    */

    'delivery_methods' => [
        'courier' => ['label' => 'Kurier', 'price' => 15.99],
        'pickup_point' => ['label' => 'Paczkomat', 'price' => 12.99],
        'store_pickup' => ['label' => 'Odbiór w sklepie', 'price' => 0],
    ],

    // Checked against the subtotal minus the discount.
    'free_delivery_from' => 300,

    'pickup_points' => [
        ['code' => 'WAW01M', 'address' => 'ul. Lipowa 12, 00-101 Warszawa'],
        ['code' => 'KRK04A', 'address' => 'ul. Ogrodowa 7, 30-002 Kraków'],
        ['code' => 'GDA02B', 'address' => 'ul. Morska 21, 80-103 Gdańsk'],
        ['code' => 'WRO09C', 'address' => 'ul. Słoneczna 3, 50-104 Wrocław'],
    ],

    'bank_account' => '12 3456 7890 1234 5678 9012 3456',

    // Fictional details printed on invoices.
    'seller' => [
        'name' => 'Sklep Online sp. z o.o.',
        'address' => 'ul. Przykładowa 1, 00-001 Warszawa',
        'nip' => '525-000-00-00',
        'bank_account' => '12 3456 7890 1234 5678 9012 3456',
    ],

    // Percent. Prices in the shop are gross.
    'vat_rate' => 23,

    // Read by `php artisan shop:admin`. There is no default password on purpose.
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],

];
