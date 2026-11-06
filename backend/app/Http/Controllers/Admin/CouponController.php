<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    private const PER_PAGE = 20;

    public function index()
    {
        return response()->json(Coupon::query()->orderBy('id', 'desc')->paginate(self::PER_PAGE));
    }

    public function show(Coupon $coupon)
    {
        return response()->json($coupon);
    }

    public function store(Request $request)
    {
        return response()->json(Coupon::create($this->validated($request))->refresh(), 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $coupon->update($this->validated($request, $coupon));

        return response()->json($coupon);
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();

        return response()->json(['message' => 'Kod rabatowy został usunięty.']);
    }

    private function validated(Request $request, ?Coupon $coupon = null): array
    {
        if (is_string($request->input('code'))) {
            $request->merge(['code' => Coupon::normalizeCode($request->input('code'))]);
        }

        $required = $coupon ? 'sometimes|required' : 'required';
        $type = $request->input('type', $coupon?->type);

        return $request->validate([
            'code' => [
                ...explode('|', $required),
                'string',
                'max:64',
                'regex:/\A[A-Z0-9_-]+\z/',
                Rule::unique('coupons', 'code')->ignore($coupon),
            ],
            'type' => [...explode('|', $required), Rule::in(Coupon::TYPES)],
            'value' => [...explode('|', $required), 'numeric', 'min:0.01', $type === 'percent' ? 'max:100' : 'max:99999999.99'],
            'min_order' => 'sometimes|numeric|min:0|max:99999999.99',
            'max_uses' => 'sometimes|nullable|integer|min:1',
            'expires_at' => 'sometimes|nullable|date',
            'is_active' => 'sometimes|boolean',
        ]);
    }
}
