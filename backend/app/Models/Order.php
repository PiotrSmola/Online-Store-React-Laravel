<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'customer_id',
        'total_amount',
        'status',
        'payment_method',
        'delivery_method',
        'delivery_price',
        'billing_address',
        'shipping_address',
        'payment_details',
        'order_date',
    ];

    protected $casts = [
        'billing_address' => 'array',
        'shipping_address' => 'array',
        'payment_details' => 'array',
        'total_amount' => 'decimal:2',
        'delivery_price' => 'decimal:2',
        'order_date' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($order) {
            $order->order_number = 'ORD-' . strtoupper(uniqid());
        });
    }

    public function getPaymentMethodLabelAttribute()
    {
        $methods = [
            'card' => 'Płatność kartą',
            'transfer' => 'Przelew bankowy',
            'cash' => 'Płatność w sklepie'
        ];

        return $methods[$this->payment_method] ?? $this->payment_method;
    }

    public function getDeliveryMethodLabelAttribute()
    {
        $methods = [
            'courier' => 'Kurier',
            'pickup_point' => 'Paczkomat',
            'store_pickup' => 'Odbiór w sklepie'
        ];

        return $methods[$this->delivery_method] ?? $this->delivery_method;
    }

    public function getPaymentMethodIconAttribute()
    {
        $icons = [
            'card' => 'fa-credit-card',
            'transfer' => 'fa-bank',
            'cash' => 'fa-money'
        ];

        return $icons[$this->payment_method] ?? 'fa-credit-card';
    }

    public function getDeliveryMethodIconAttribute()
    {
        $icons = [
            'courier' => 'fa-truck',
            'pickup_point' => 'fa-archive',
            'store_pickup' => 'fa-store'
        ];

        return $icons[$this->delivery_method] ?? 'fa-truck';
    }

    public function getIsFreeDeliveryAttribute()
    {
        return $this->delivery_price == 0;
    }

    public function getProductsValueAttribute()
    {
        return $this->total_amount - $this->delivery_price;
    }
}
