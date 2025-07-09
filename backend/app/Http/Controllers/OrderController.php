<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        Log::info('Otrzymane dane zamówienia:', $request->all());

        try {
            $validatedData = $request->validate([
                'customer_type' => 'required|in:individual,company',
                'email' => 'required|email',
                'password' => 'nullable|min:6',
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'phone' => 'required|string|max:20',
                'address' => 'required|string|max:255',
                'city' => 'required|string|max:255',
                'postal_code' => 'required|string|max:10',
                'country' => 'required|string|max:255',
                'company_name' => 'nullable|string|max:255',
                'nip' => 'nullable|string|max:20',
                'payment_method' => 'required|in:card,transfer,cash',
                'delivery_method' => 'required|in:courier,pickup_point,store_pickup',
                'delivery_price' => 'required|numeric|min:0',
                'total_with_delivery' => 'required|numeric|min:0',
                'cart_items' => 'required|array|min:1',
                'cart_items.*.product_id' => 'required|exists:products,id',
                'cart_items.*.quantity' => 'required|integer|min:1',
                'cart_items.*.selected_size' => 'nullable|string',
                'cart_items.*.selected_color' => 'nullable|string',
                'payment' => 'required|array',
                'payment.card_number' => 'required_if:payment_method,card|string',
                'payment.card_name' => 'required_if:payment_method,card|string|max:255',
                'payment.expiry_date' => 'required_if:payment_method,card|string',
                'payment.cvv' => 'required_if:payment_method,card|string',
            ]);

            if ($request->payment_method === 'card') {
                $this->validateCardPayment($request->payment);
            }

            Log::info('Dane po walidacji:', $validatedData);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Błędy walidacji:', $e->errors());
            return response()->json([
                'message' => 'Błędy walidacji',
                'errors' => $e->errors()
            ], 422);
        }

        return DB::transaction(function () use ($request) {
            try {
                $customer = Customer::where('email', $request->email)->first();

                if (!$customer) {
                    if (!$request->password) {
                        return response()->json([
                            'message' => 'Hasło jest wymagane dla nowego klienta',
                            'errors' => ['password' => ['Hasło jest wymagane']]
                        ], 422);
                    }

                    $customer = Customer::create([
                        'email' => $request->email,
                        'password' => Hash::make($request->password),
                        'first_name' => $request->first_name,
                        'last_name' => $request->last_name,
                        'phone' => $request->phone,
                        'company_name' => $request->company_name,
                        'nip' => $request->nip,
                        'address' => $request->address,
                        'city' => $request->city,
                        'postal_code' => $request->postal_code,
                        'country' => $request->country,
                        'customer_type' => $request->customer_type,
                    ]);

                    Log::info('Utworzono nowego klienta:', ['id' => $customer->id]);
                } else {
                    $customer->update([
                        'first_name' => $request->first_name,
                        'last_name' => $request->last_name,
                        'phone' => $request->phone,
                        'company_name' => $request->company_name,
                        'nip' => $request->nip,
                        'address' => $request->address,
                        'city' => $request->city,
                        'postal_code' => $request->postal_code,
                        'country' => $request->country,
                        'customer_type' => $request->customer_type,
                    ]);
                }

                $totalAmount = 0;
                $orderItems = [];

                foreach ($request->cart_items as $item) {
                    $product = Product::find($item['product_id']);
                    if (!$product) {
                        throw new \Exception("Produkt o ID {$item['product_id']} nie istnieje");
                    }

                    $itemTotal = $product->cena * $item['quantity'];
                    $totalAmount += $itemTotal;

                    $orderItems[] = [
                        'product_id' => $product->id,
                        'quantity' => $item['quantity'],
                        'price' => $product->cena,
                        'selected_size' => $item['selected_size'] ?? null,
                        'selected_color' => $item['selected_color'] ?? null,
                    ];
                }

                $totalAmount += $request->delivery_price;

                Log::info('Obliczono pozycje zamówienia:', $orderItems);

                $paymentDetails = [
                    'method' => $request->payment_method,
                ];

                if ($request->payment_method === 'card') {
                    $cardNumber = str_replace(' ', '', $request->payment['card_number']);
                    $paymentDetails['card_last_four'] = substr($cardNumber, -4);
                    $paymentDetails['card_name'] = $request->payment['card_name'];
                } elseif ($request->payment_method === 'transfer') {
                    $paymentDetails['instructions'] = 'Przelew na konto: 12 3456 7890 1234 5678 9012 3456';
                } elseif ($request->payment_method === 'cash') {
                    $paymentDetails['instructions'] = 'Płatność przy odbiorze w sklepie';
                }

                $order = Order::create([
                    'customer_id' => $customer->id,
                    'total_amount' => $totalAmount,
                    'status' => 'pending',
                    'payment_method' => $request->payment_method,
                    'delivery_method' => $request->delivery_method,
                    'delivery_price' => $request->delivery_price,
                    'billing_address' => [
                        'first_name' => $request->first_name,
                        'last_name' => $request->last_name,
                        'company_name' => $request->company_name,
                        'address' => $request->address,
                        'city' => $request->city,
                        'postal_code' => $request->postal_code,
                        'country' => $request->country,
                    ],
                    'shipping_address' => [
                        'first_name' => $request->first_name,
                        'last_name' => $request->last_name,
                        'company_name' => $request->company_name,
                        'address' => $request->address,
                        'city' => $request->city,
                        'postal_code' => $request->postal_code,
                        'country' => $request->country,
                    ],
                    'payment_details' => $paymentDetails,
                    'order_date' => now(),
                ]);

                Log::info('Utworzono zamówienie:', ['id' => $order->id]);

                foreach ($orderItems as $item) {
                    $order->items()->create($item);
                }

                $token = $customer->createToken('customer-token')->plainTextToken;

                Log::info('Zamówienie zakończone pomyślnie');

                return response()->json([
                    'order' => $order->load('items.product.images'),
                    'customer' => $customer,
                    'token' => $token,
                    'message' => 'Zamówienie zostało złożone pomyślnie!'
                ]);
            } catch (\Exception $e) {
                Log::error('Błąd podczas tworzenia zamówienia:', [
                    'message' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);

                return response()->json([
                    'message' => 'Błąd podczas tworzenia zamówienia: ' . $e->getMessage()
                ], 500);
            }
        });
    }

    // Walidacja płatności kartą (algorytm Luhn)
    private function validateCardPayment($paymentData)
    {
        $errors = [];

        $cardNumber = str_replace(' ', '', $paymentData['card_number']);

        if (!$this->validateCardNumberLuhn($cardNumber)) {
            $errors['payment.card_number'] = ['Nieprawidłowy numer karty'];
        }

        if (strlen($cardNumber) < 13 || strlen($cardNumber) > 19) {
            $errors['payment.card_number'] = ['Numer karty musi mieć od 13 do 19 cyfr'];
        }

        if (!preg_match('/^\d{2}\/\d{2}$/', $paymentData['expiry_date'])) {
            $errors['payment.expiry_date'] = ['Data ważności musi być w formacie MM/RR'];
        } else {
            [$month, $year] = explode('/', $paymentData['expiry_date']);
            $currentYear = date('y');
            $currentMonth = date('n');

            if ($month < 1 || $month > 12) {
                $errors['payment.expiry_date'] = ['Nieprawidłowy miesiąc'];
            } elseif ($year < $currentYear || ($year == $currentYear && $month < $currentMonth)) {
                $errors['payment.expiry_date'] = ['Karta jest przeterminowana'];
            }
        }

        // Walidacja CVV
        if (!preg_match('/^\d{3,4}$/', $paymentData['cvv'])) {
            $errors['payment.cvv'] = ['CVV musi mieć 3-4 cyfry'];
        }

        if (empty(trim($paymentData['card_name']))) {
            $errors['payment.card_name'] = ['Imię i nazwisko posiadacza karty jest wymagane'];
        }

        if (!empty($errors)) {
            throw new \Illuminate\Validation\ValidationException(
                validator([], []),
                response()->json(['errors' => $errors], 422)
            );
        }
    }

    // Algorytm Luhn do walidacji numeru karty kredytowej
    private function validateCardNumberLuhn($cardNumber)
    {
        if (!ctype_digit($cardNumber)) {
            return false;
        }

        $digits = str_split($cardNumber);
        $sum = 0;
        $alternate = false;

        for ($i = count($digits) - 1; $i >= 0; $i--) {
            $n = intval($digits[$i]);

            if ($alternate) {
                $n *= 2;
                if ($n > 9) {
                    $n = ($n % 10) + 1;
                }
            }

            $sum += $n;
            $alternate = !$alternate;
        }

        return ($sum % 10) === 0;
    }

    public function index(Request $request)
    {
        $orders = $request->user()->orders()
            ->with('items.product.images')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        if ($order->customer_id !== $request->user()->id) {
            return response()->json(['message' => 'Brak dostępu'], 403);
        }

        $order->load('items.product.images');
        return response()->json($order);
    }
}
