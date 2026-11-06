<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Coupon extends Model
{
    public const TYPES = ['percent', 'fixed'];

    private const UNKNOWN_CODE = 'Nieprawidłowy kod rabatowy';

    // used_count changes only in OrderService, under a lock.
    protected $fillable = [
        'code',
        'type',
        'value',
        'min_order',
        'max_uses',
        'expires_at',
        'is_active',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'min_order' => 'decimal:2',
        'max_uses' => 'integer',
        'used_count' => 'integer',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected $attributes = [
        'used_count' => 0,
        'is_active' => true,
    ];

    /** Codes are stored in capitals, because sqlite compares case but MySQL's collation does not. */
    public static function normalizeCode(string $code): string
    {
        return Str::upper(trim($code));
    }

    public function setCodeAttribute(string $value): void
    {
        $this->attributes['code'] = self::normalizeCode($value);
    }

    /** A disabled code answers like one that never existed. */
    public static function unknownCodeMessage(): string
    {
        return self::UNKNOWN_CODE;
    }

    public function rejectionFor(int $subtotalGrosze): ?string
    {
        if (!$this->is_active) {
            return self::UNKNOWN_CODE;
        }

        if ($this->expires_at?->isPast()) {
            return 'Ten kod rabatowy wygasł';
        }

        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) {
            return 'Ten kod rabatowy został już wykorzystany';
        }

        if ($subtotalGrosze < self::grosze($this->min_order)) {
            return 'Minimalna wartość zamówienia dla tego kodu to ' . self::formatPln($this->min_order);
        }

        return null;
    }

    public function discountFor(int $subtotalGrosze): int
    {
        $discount = $this->type === 'percent'
            ? (int) round($subtotalGrosze * (float) $this->value / 100)
            : self::grosze($this->value);

        return min($discount, $subtotalGrosze);
    }

    public function getLabelAttribute(): string
    {
        return $this->type === 'percent'
            ? 'Rabat ' . rtrim(rtrim($this->value, '0'), '.') . '%'
            : 'Rabat ' . self::formatPln($this->value);
    }

    /** Takes one use, unless the limit was reached. @return bool whether a use was taken */
    public static function takeUse(string $code): bool
    {
        return (bool) self::query()
            ->where('code', $code)
            ->where(fn (Builder $query) => $query->whereNull('max_uses')->orWhereColumn('used_count', '<', 'max_uses'))
            ->increment('used_count');
    }

    public static function releaseUse(string $code): void
    {
        self::query()->where('code', $code)->where('used_count', '>', 0)->decrement('used_count');
    }

    private static function grosze(string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private static function formatPln(string $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ') . ' zł';
    }
}
