<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    public const STATUS_LABELS = [
        'pending' => 'Oczekuje na realizację',
        'processing' => 'W realizacji',
        'shipped' => 'Wysłane',
        'delivered' => 'Dostarczone',
        'cancelled' => 'Anulowane',
    ];

    public const PAYMENT_STATUS_LABELS = [
        'unpaid' => 'Nieopłacone',
        'paid' => 'Opłacone',
        'failed' => 'Płatność nieudana',
        'refunded' => 'Zwrócone',
    ];

    public const STATUS_TRANSITIONS = [
        'pending' => ['processing', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered'],
    ];

    private const PAYMENT_METHOD_LABELS = [
        'card' => 'Płatność kartą',
        'transfer' => 'Przelew bankowy',
        'cash' => 'Płatność w sklepie',
    ];

    // payment_status, paid_at and invoice_number are set by the services, never from a request.
    protected $fillable = [
        'order_number',
        'customer_id',
        'subtotal_amount',
        'discount_amount',
        'coupon_code',
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
        'subtotal_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'delivery_price' => 'decimal:2',
        'order_date' => 'datetime',
        'paid_at' => 'datetime',
    ];

    protected $attributes = [
        'payment_status' => 'unpaid',
    ];

    protected $appends = [
        'status_label',
        'payment_status_label',
        'payment_method_label',
        'delivery_method_label',
        'next_statuses',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusEvents()
    {
        return $this->hasMany(OrderStatusEvent::class)->orderBy('created_at')->orderBy('id');
    }

    public function scopeWithDetails(Builder $query): Builder
    {
        return $query->with(self::DETAILS);
    }

    /** What every order response carries. Products without their description bodies. */
    public const DETAILS = [
        'items.product:id,nazwa,kategoria,cena',
        'items.product.images:id,product_id,image_path,order',
        'statusEvents',
    ];

    public function isOwnedBy(Customer $customer): bool
    {
        return (int) $this->customer_id === (int) $customer->id;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($order) {
            $order->order_number = 'ORD-' . strtoupper(uniqid());
        });
    }

    public function getStatusLabelAttribute(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    public function getPaymentStatusLabelAttribute(): string
    {
        return self::PAYMENT_STATUS_LABELS[$this->payment_status] ?? $this->payment_status;
    }

    public function getPaymentMethodLabelAttribute()
    {
        return self::PAYMENT_METHOD_LABELS[$this->payment_method] ?? $this->payment_method;
    }

    public function getDeliveryMethodLabelAttribute()
    {
        return config('shop.delivery_methods')[$this->delivery_method]['label'] ?? $this->delivery_method;
    }

    /** @return list<string> */
    public function getNextStatusesAttribute(): array
    {
        return self::STATUS_TRANSITIONS[$this->status] ?? [];
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
