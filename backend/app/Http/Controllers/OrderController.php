<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Services\CartPricing;
use App\Services\OrderService;
use App\Support\PasswordAttempts;
use App\Support\SafeExceptionContext;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const ACCOUNT_EXISTS_MESSAGE = 'Konto z tym adresem e-mail już istnieje. Zaloguj się, aby złożyć zamówienie.';

    private const ORDERS_PER_PAGE = 20;

    public function __construct(private OrderService $orders, private CartPricing $pricing)
    {
    }

    public function store(Request $request)
    {
        try {
            $authenticatedCustomer = $request->user('sanctum');

            $validated = $request->validate($this->checkoutRules($request, $authenticatedCustomer !== null), [
                'cart_items.*.quantity.max' => 'Maksymalna ilość jednego produktu to 99',
            ]);

            $customer = $authenticatedCustomer ?? $this->findCustomerForGuest($request);
            $items = $this->checkedItems($validated['cart_items']);

            // Failure paths must throw: a response returned from this closure would commit.
            return DB::transaction(function () use ($request, $validated, $customer, $authenticatedCustomer, $items) {
                $customerData = $this->customerData($validated);

                if ($customer) {
                    $customer->update($customerData);
                } else {
                    try {
                        $customer = Customer::create($customerData + [
                            'email' => $request->email,
                            'password' => Hash::make($request->password),
                        ]);
                    } catch (UniqueConstraintViolationException) {
                        // Another request registered the address after the lookup, or the
                        // unique index treats it as equal to one the lookup did not match.
                        throw ValidationException::withMessages(['email' => [self::ACCOUNT_EXISTS_MESSAGE]]);
                    }
                }

                $order = $this->orders->place($customer, [
                    'items' => $items,
                    'payment_method' => $validated['payment_method'],
                    'delivery_method' => $validated['delivery_method'],
                    'billing_address' => $this->billingAddress($validated),
                    'shipping_address' => $this->shippingAddress($validated),
                    'payment_details' => $this->paymentDetails($validated),
                ]);

                $response = [
                    'order' => $order->load(Order::DETAILS),
                    'customer' => $customer,
                    'message' => 'Zamówienie zostało złożone pomyślnie!'
                ];

                // A request that came with a token already has one; new tokens are only
                // for accounts created here or proven by the correct password.
                if (!$authenticatedCustomer) {
                    $response['token'] = $customer->createToken('customer-token')->plainTextToken;
                }

                return response()->json($response);
            }, 3);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Błędy walidacji',
                'errors' => $e->errors()
            ], 422);
        } catch (HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Throwable $e) {
            Log::error('Order creation failed', SafeExceptionContext::of($e));

            return response()->json([
                'message' => 'Nie udało się złożyć zamówienia. Spróbuj ponownie później.'
            ], 500);
        }
    }

    private function checkoutRules(Request $request, bool $isAuthenticated): array
    {
        return [
            'customer_type' => 'required|in:individual,company',
            'email' => $isAuthenticated ? 'nullable' : 'required|email',
            'password' => 'nullable|string',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'address' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'postal_code' => 'required|string|max:10',
            'country' => 'required|string|max:255',
            'company_name' => 'nullable|required_if:customer_type,company|string|max:255',
            'nip' => 'nullable|required_if:customer_type,company|string|max:20',
            'payment_method' => [
                'required',
                'in:card,transfer,cash',
                function (string $attribute, mixed $value, \Closure $fail) use ($request) {
                    if ($value === 'cash' && $request->input('delivery_method') !== 'store_pickup') {
                        $fail('Płatność gotówką jest możliwa tylko przy odbiorze w sklepie.');
                    }
                },
            ],
            'delivery_method' => ['required', Rule::in(array_keys(config('shop.delivery_methods')))],
            'pickup_point' => [
                'nullable',
                'required_if:delivery_method,pickup_point',
                Rule::in(array_column(config('shop.pickup_points'), 'code')),
            ],
            'shipping' => 'nullable|array',
            'shipping.first_name' => 'required_with:shipping|string|max:255',
            'shipping.last_name' => 'required_with:shipping|string|max:255',
            'shipping.company_name' => 'nullable|string|max:255',
            'shipping.address' => 'required_with:shipping|string|max:255',
            'shipping.city' => 'required_with:shipping|string|max:255',
            'shipping.postal_code' => 'required_with:shipping|string|max:10',
            'shipping.country' => 'required_with:shipping|string|max:255',
            'cart_items' => 'required|array|min:1|max:100',
            'cart_items.*.product_id' => 'required|integer|exists:products,id',
            'cart_items.*.quantity' => 'required|integer|min:1|max:99',
            'cart_items.*.selected_size' => 'nullable|string|max:255',
            'cart_items.*.selected_color' => 'nullable|string|max:255',
        ];
    }

    // For a request without a token: the existing account if the password proves ownership,
    // null if the email is free and a new account may be created.
    private function findCustomerForGuest(Request $request): ?Customer
    {
        $customer = Customer::where('email', $request->email)->first();

        if ($customer) {
            if ($request->password === null || !$this->passwordMatches($request, $customer)) {
                throw ValidationException::withMessages(['email' => [self::ACCOUNT_EXISTS_MESSAGE]]);
            }

            return $customer;
        }

        if ($request->password === null) {
            throw ValidationException::withMessages([
                'password' => ['Hasło jest wymagane'],
            ]);
        }

        Validator::make(['password' => $request->password], ['password' => [Password::defaults()]])->validate();

        return null;
    }

    // Every failed password check spends the budget of the login route, so this endpoint
    // cannot be used to guess more passwords than login allows.
    private function passwordMatches(Request $request, Customer $customer): bool
    {
        $limit = RateLimiter::limiter('login')($request);
        $bucket = md5('login' . $limit->key); // The name throttle:login gives its bucket.

        if (RateLimiter::tooManyAttempts($bucket, $limit->maxAttempts)) {
            throw new HttpResponseException(PasswordAttempts::tooManyResponse([
                'Retry-After' => RateLimiter::availableIn($bucket),
            ]));
        }

        if (PasswordAttempts::verify($request, $customer)) {
            return true;
        }

        RateLimiter::hit($bucket, $limit->decaySeconds);

        return false;
    }

    /**
     * Checks the chosen options against what each product offers, naming the cart line.
     * Stock is checked later, under the lock.
     */
    private function checkedItems(array $cartItems): array
    {
        $products = Product::query()
            ->whereIn('id', array_column($cartItems, 'product_id'))
            ->get(['id', 'nazwa', 'rozmiar', 'kolor'])
            ->keyBy('id');

        $items = [];
        $errors = [];

        foreach ($cartItems as $index => $item) {
            $product = $products->get($item['product_id']);
            $size = $item['selected_size'] ?? null;
            $color = $item['selected_color'] ?? null;

            if (!$product) {
                $errors["cart_items.{$index}.product_id"] = ['Ten produkt jest już niedostępny'];

                continue;
            }

            $optionErrors = $this->pricing->optionErrors($product, $size, $color);

            if ($optionErrors['size']) {
                $errors["cart_items.{$index}.selected_size"] = [$optionErrors['size']];
            }

            if ($optionErrors['color']) {
                $errors["cart_items.{$index}.selected_color"] = [$optionErrors['color']];
            }

            $items[] = [
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'size' => $size,
                'color' => $color,
            ];
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $items;
    }

    private function customerData(array $validated): array
    {
        return [
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'phone' => $validated['phone'],
            'company_name' => $validated['company_name'] ?? null,
            'nip' => $validated['nip'] ?? null,
            'address' => $validated['address'],
            'city' => $validated['city'],
            'postal_code' => $validated['postal_code'],
            'country' => $validated['country'],
            'customer_type' => $validated['customer_type'],
        ];
    }

    private function billingAddress(array $validated): array
    {
        return [
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'company_name' => $validated['company_name'] ?? null,
            'nip' => $validated['nip'] ?? null,
            'address' => $validated['address'],
            'city' => $validated['city'],
            'postal_code' => $validated['postal_code'],
            'country' => $validated['country'],
        ];
    }

    private function shippingAddress(array $validated): array
    {
        $shipping = $validated['shipping'] ?? [];

        $address = [
            'first_name' => $shipping['first_name'] ?? $validated['first_name'],
            'last_name' => $shipping['last_name'] ?? $validated['last_name'],
            'company_name' => $shipping ? ($shipping['company_name'] ?? null) : ($validated['company_name'] ?? null),
            'address' => $shipping['address'] ?? $validated['address'],
            'city' => $shipping['city'] ?? $validated['city'],
            'postal_code' => $shipping['postal_code'] ?? $validated['postal_code'],
            'country' => $shipping['country'] ?? $validated['country'],
        ];

        if ($validated['delivery_method'] === 'pickup_point') {
            $address['pickup_point'] = collect(config('shop.pickup_points'))->firstWhere('code', $validated['pickup_point']);
        }

        return $address;
    }

    private function paymentDetails(array $validated): array
    {
        $method = $validated['payment_method'];
        $details = ['method' => $method];

        if ($method === 'transfer') {
            $details['instructions'] = 'Przelew na konto: ' . config('shop.bank_account');
        } elseif ($method === 'cash') {
            $details['instructions'] = 'Płatność przy odbiorze w sklepie';
        }

        return $details;
    }

    public function index(Request $request)
    {
        $orders = $request->user()->orders()
            ->withDetails()
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc')
            ->paginate(self::ORDERS_PER_PAGE);

        return response()->json($orders);
    }

    public function show(Request $request, Order $order)
    {
        $this->ensureOwner($request, $order);

        return response()->json($order->load(Order::DETAILS));
    }

    public function cancel(Request $request, Order $order)
    {
        $this->ensureOwner($request, $order);

        $cancelled = $this->orders->changeStatus($order, 'cancelled', 'Anulowane przez klienta', requiredStatus: 'pending');

        return response()->json($cancelled->load(Order::DETAILS));
    }

    public function pay(Request $request, Order $order)
    {
        $this->ensureOwner($request, $order);

        $validated = $request->validate([
            'card_last_four' => ['required', 'string', 'regex:/\A[0-9]{4}\z/'],
        ]);

        $order = $this->orders->pay($order, $validated['card_last_four'])->load(Order::DETAILS);

        // The failed state has to stay saved, so a decline is not an exception out of the transaction.
        if ($order->payment_status === 'failed') {
            return response()->json([
                'message' => 'Płatność została odrzucona. Spróbuj ponownie lub użyj innej karty.',
                'order' => $order,
            ], 402);
        }

        return response()->json($order);
    }

    private function ensureOwner(Request $request, Order $order): void
    {
        abort_unless($order->isOwnedBy($request->user()), response()->json(['message' => 'Brak dostępu'], 403));
    }
}
