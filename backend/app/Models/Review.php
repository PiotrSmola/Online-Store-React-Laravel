<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $fillable = [
        'product_id',
        'customer_id',
        'rating',
        'comment',
    ];

    protected $casts = [
        'rating' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    /** "Anna N.": all a reader sees of the reviewer. */
    public function getAuthorAttribute(): string
    {
        return trim($this->customer->first_name . ' ' . mb_substr($this->customer->last_name, 0, 1) . '.');
    }

    /** What the public sees: no customer id, no email. */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'author' => $this->author,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'created_at' => $this->created_at,
        ];
    }
}
