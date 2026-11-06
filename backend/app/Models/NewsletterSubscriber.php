<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    // confirmed_at is set only by following the emailed link.
    protected $fillable = [
        'email',
        'confirm_token',
        'unsubscribe_token',
    ];

    protected $hidden = [
        'confirm_token',
        'unsubscribe_token',
    ];

    protected $casts = [
        'confirmed_at' => 'datetime',
    ];
}
