<?php

$list = fn (string $variable, string $default) => array_values(array_filter(
    array_map('trim', explode(',', (string) env($variable, $default))),
    fn (string $value) => $value !== '' && $value !== '*'
));

return [

    /*
    | The Docker stack serves the shop and the API from one origin through nginx, so
    | browsers there never need CORS. Separate dev servers are listed in
    | CORS_ALLOWED_ORIGINS. A "*" in these variables is ignored: nothing is a wildcard.
    */

    'paths' => ['api/*'],

    'allowed_methods' => $list('CORS_ALLOWED_METHODS', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'),

    'allowed_origins' => $list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000'),

    'allowed_origins_patterns' => [],

    'allowed_headers' => $list('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization,Accept,X-Requested-With'),

    // The invoice download reads its file name from here.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 3600,

    'supports_credentials' => false,

];
