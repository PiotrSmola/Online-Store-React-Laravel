<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        try {
            $authenticatedCustomer = $request->user('sanctum');

            $request->validate([
                'customer_type' => 'required|in:individual,company',
                'email' => $authenticatedCustomer ? 'nullable' : 'required|email',
                'password' => 'nullable|string',
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
                'delivery_method' => ['required', Rule::in(array_keys(config('shop.delivery_prices')))],
                'cart_items' => 'required|array|min:1',
                'cart_items.*.product_id' => 'required|integer|exists:products,id',
                'cart_items.*.quantity' => 'required|integer|min:1',
                'cart_items.*.selected_size' => 'nullable|string',
                'cart_items.*.selected_color' => 'nullable|string',
                'payment' => 'required|array',
                'payment.card_number' => 'required_if:payment_method,card|nullable|string',
                'payment.card_name' => 'required_if:payment_method,card|nullable|string|max:255',
                'payment.expiry_date' => 'required_if:payment_method,card|nullable|string',
                'payment.cvv' => 'required_if:payment_method,card|nullable|string',
            ]);

            if ($request->payment_method === 'card') {
                $this->validateCardPayment($request->payment);
            }

            $customer = $authenticatedCustomer ?? $this->findCustomerForGuest($request);
            $orderItems = $this->buildOrderItems($request->cart_items);

            // Failure paths must throw: a response returned from this closure would commit.
            return DB::transaction(function () use ($request, $customer, $authenticatedCustomer, $orderItems) {
                $customerData = [
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
                ];

                if ($customer) {
                    $customer->update($customerData);
                } else {
                    $customer = Customer::create($customerData + [
                        'email' => $request->email,
                        'password' => Hash::make($request->password),
                    ]);
                }

                $itemsTotal = array_sum(array_map(fn ($item) => $item['price'] * $item['quantity'], $orderItems));
                $deliveryPrice = config('shop.delivery_prices')[$request->delivery_method];
                $totalAmount = round($itemsTotal + $deliveryPrice, 2);

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
                    'delivery_price' => $deliveryPrice,
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

                Log::info('Order created', ['order_id' => $order->id]);

                foreach ($orderItems as $item) {
                    $order->items()->create($item);
                }

                $response = [
                    'order' => $order->load('items.product.images'),
                    'customer' => $customer,
                    'message' => 'Zamówienie zostało złożone pomyślnie!'
                ];

                // A request that came with a token already has one; new tokens are only
                // for accounts created here or proven by the correct password.
                if (!$authenticatedCustomer) {
                    $response['token'] = $customer->createToken('customer-token')->plainTextToken;
                }

                return response()->json($response);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Błędy walidacji',
                'errors' => $e->errors()
            ], 422);
        } catch (HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Throwable $e) {
            Log::error('Order creation failed', $this->safeExceptionContext($e));

            return response()->json([
                'message' => 'Nie udało się złożyć zamówienia. Spróbuj ponownie później.'
            ], 500);
        }
    }

    // For a request without a token: the existing account if the password proves ownership,
    // null if the email is free and a new account may be created.
    private function findCustomerForGuest(Request $request): ?Customer
    {
        $customer = Customer::where('email', $request->email)->first();

        if ($customer) {
            if ($request->password === null || !$this->passwordMatches($request, $customer)) {
                throw ValidationException::withMessages([
                    'email' => ['Konto z tym adresem e-mail już istnieje. Zaloguj się, aby złożyć zamówienie.'],
                ]);
            }

            return $customer;
        }

        if ($request->password === null) {
            throw ValidationException::withMessages([
                'password' => ['Hasło jest wymagane'],
            ]);
        }

        if (mb_strlen($request->password) < 6) {
            throw ValidationException::withMessages([
                'password' => ['Hasło musi mieć minimum 6 znaków'],
            ]);
        }

        return null;
    }

    // Every failed password check spends the budget of the login route, so this endpoint
    // cannot be used to guess more passwords than login allows.
    private function passwordMatches(Request $request, Customer $customer): bool
    {
        $limit = RateLimiter::limiter('login')($request);
        $bucket = md5('login' . $limit->key); // The name throttle:login gives its bucket.

        if (RateLimiter::tooManyAttempts($bucket, $limit->maxAttempts)) {
            throw new HttpResponseException(($limit->responseCallback)($request, [
                'Retry-After' => RateLimiter::availableIn($bucket),
            ]));
        }

        if (Hash::check($request->password, $customer->password)) {
            return true;
        }

        RateLimiter::hit($bucket, $limit->decaySeconds);

        return false;
    }

    private function buildOrderItems(array $cartItems): array
    {
        $orderItems = [];
        $errors = [];

        foreach ($cartItems as $index => $item) {
            $product = Product::findOrFail($item['product_id']);
            $selectedSize = $item['selected_size'] ?? null;
            $selectedColor = $item['selected_color'] ?? null;

            if ($error = $this->optionError($product, 'rozmiar', $product->rozmiar, $selectedSize)) {
                $errors["cart_items.{$index}.selected_size"] = [$error];
            }

            if ($error = $this->optionError($product, 'kolor', $product->kolor, $selectedColor)) {
                $errors["cart_items.{$index}.selected_color"] = [$error];
            }

            $orderItems[] = [
                'product_id' => $product->id,
                'quantity' => $item['quantity'],
                'price' => $product->cena,
                'selected_size' => blank($selectedSize) ? null : $selectedSize,
                'selected_color' => blank($selectedColor) ? null : $selectedColor,
            ];
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $orderItems;
    }

    // $offered is the product's JSON column, which can be null or an empty list.
    private function optionError(Product $product, string $label, mixed $offered, ?string $selected): ?string
    {
        $options = array_map('strval', array_filter((array) $offered, fn ($option) => !blank($option)));

        if ($options === []) {
            return blank($selected) ? null : "Produkt „{$product->nazwa}” nie ma opcji: {$label}";
        }

        if (blank($selected)) {
            return "Wybierz {$label} produktu „{$product->nazwa}”";
        }

        return in_array($selected, $options, true)
            ? null
            : "Wybrany {$label} produktu „{$product->nazwa}” jest niedostępny";
    }

    // Exception messages can embed SQL bindings (emails, password hashes) and trace
    // strings embed call arguments, so only the type and code locations are logged.
    private function safeExceptionContext(\Throwable $e): array
    {
        $appFrames = [];

        foreach ($e->getTrace() as $frame) {
            if (isset($frame['file']) && !str_contains($frame['file'], DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR)) {
                $appFrames[] = $frame['file'] . ':' . ($frame['line'] ?? '?');
            }
        }

        return [
            'exception_class' => $e::class,
            'code' => $e->getCode(),
            'location' => $e->getFile() . ':' . $e->getLine(),
            'app_frames' => array_slice($appFrames, 0, 10),
        ];
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
            throw ValidationException::withMessages($errors);
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
