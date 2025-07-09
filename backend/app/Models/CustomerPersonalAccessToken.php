<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class CustomerPersonalAccessToken extends SanctumPersonalAccessToken
{
    protected $table = 'customer_personal_access_tokens';
}
