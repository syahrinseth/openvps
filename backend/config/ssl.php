<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SSL Certificate Admin Email
    |--------------------------------------------------------------------------
    |
    | This email address is used when registering with Let's Encrypt via
    | certbot. It must be a valid, reachable email address so that
    | Let's Encrypt can send expiry notices and security alerts.
    |
    */

    'admin_email' => env('SSL_ADMIN_EMAIL', 'admin@example.com'),

];
