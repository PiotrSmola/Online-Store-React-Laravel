<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CartItem extends Model
{
    protected $fillable = [
        'customer_id',
        'product_id',
        'size',
        'color',
        'quantity',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];
}
