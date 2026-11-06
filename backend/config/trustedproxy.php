<?php

return [

    /*
    | Comma separated IPs or CIDR ranges whose X-Forwarded-For is believed, read
    | by the framework's TrustProxies middleware. Empty means no proxy is trusted.
    | List only the reverse proxy itself: anything else that can reach the app
    | from a trusted address could choose its own client IP and dodge rate limits.
    | docker-compose.yml sets this to the fixed address of the nginx container.
    */

    'proxies' => env('TRUSTED_PROXIES') ?: null,

];
