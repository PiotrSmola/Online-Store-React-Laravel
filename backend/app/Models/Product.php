<?php
// app/Models/Product.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'nazwa',
        'kategoria',
        'cena',
        'opis',
        'ocena',
        'rozmiar',
        'kolor',
    ];

    protected $casts = [
        'rozmiar' => 'array',
        'kolor' => 'array',
        'cena' => 'decimal:2',
        'ocena' => 'decimal:1',
    ];

    protected function asJson($value)
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class)->orderBy('order');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }
}
