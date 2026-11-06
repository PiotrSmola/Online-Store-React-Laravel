<?php

namespace App\Models;

use App\Notifications\CustomerResetPassword;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Customer extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    // is_admin stays out on purpose: only `php artisan shop:admin` sets it.
    protected $fillable = [
        'email',
        'password',
        'first_name',
        'last_name',
        'phone',
        'company_name',
        'nip',
        'address',
        'city',
        'postal_code',
        'country',
        'customer_type',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
        'is_admin' => 'boolean',
    ];

    protected $attributes = [
        'is_admin' => false,
    ];

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function getFullNameAttribute()
    {
        return $this->first_name . ' ' . $this->last_name;
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new CustomerResetPassword($token));
    }
}
