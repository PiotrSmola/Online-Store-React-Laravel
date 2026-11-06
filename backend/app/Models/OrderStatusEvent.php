<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderStatusEvent extends Model
{
    protected $fillable = [
        'order_id',
        'status',
        'note',
    ];

    protected $appends = ['status_label'];

    public function getStatusLabelAttribute(): string
    {
        return Order::STATUS_LABELS[$this->status] ?? $this->status;
    }
}
