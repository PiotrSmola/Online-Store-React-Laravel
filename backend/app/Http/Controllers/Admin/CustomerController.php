<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Support\LikeSearch;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $query = Customer::query()
            ->select('id', 'email', 'first_name', 'last_name', 'phone', 'city', 'customer_type', 'company_name', 'is_admin', 'created_at')
            ->withCount('orders')
            ->orderBy('id', 'desc');

        if (filled($validated['q'] ?? null)) {
            LikeSearch::apply($query, ['email', 'first_name', 'last_name'], $validated['q']);
        }

        return response()->json($query->paginate(self::PER_PAGE)->withQueryString());
    }
}
