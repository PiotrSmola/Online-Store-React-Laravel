<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\CartPricing;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class OrderFlowTest extends TestCase
{
    use BuildsOrders, CountsQueries, RefreshDatabase;

    private function order(Product $product, array $overrides = []): TestResponse
    {
        return $this->postJson('/api/orders', $this->orderPayload($product, $overrides));
    }

    private function oneLine(Product $product, int $quantity): array
    {
        return [['product_id' => $product->id, 'quantity' => $quantity, 'selected_size' => 'M', 'selected_color' => 'Czarny']];
    }

    private function checkout(Product $product, int $quantity = 1): array
    {
        return [
            'items' => [['product_id' => $product->id, 'quantity' => $quantity, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
        ];
    }

    // Placing

    public function test_order_takes_the_stock_of_the_chosen_variant_only(): void
    {
        $product = $this->createProduct([], 5);

        $this->order($product, ['cart_items' => $this->oneLine($product, 2)])->assertOk();

        $this->assertSame(3, $this->variantOf($product)->stock);
        $this->assertSame(5, $this->variantOf($product, 'S')->stock);
    }

    public function test_order_stores_subtotal_discount_and_an_initial_event(): void
    {
        $response = $this->order($this->createProduct())->assertOk();

        $order = Order::sole();
        $this->assertSame('100.50', $order->subtotal_amount);
        $this->assertSame('0.00', $order->discount_amount);
        $this->assertSame('116.49', $order->total_amount);
        $this->assertSame('unpaid', $order->payment_status);
        $this->assertSame(['pending'], $order->statusEvents->pluck('status')->all());

        $response->assertJsonPath('order.status_label', 'Oczekuje na realizację')
            ->assertJsonPath('order.payment_status_label', 'Nieopłacone')
            ->assertJsonPath('order.payment_method_label', 'Płatność kartą')
            ->assertJsonPath('order.delivery_method_label', 'Kurier')
            ->assertJsonPath('order.next_statuses', ['processing', 'cancelled'])
            ->assertJsonPath('order.status_events.0.status_label', 'Oczekuje na realizację');
    }

    public function test_a_new_order_has_the_same_keys_as_a_stored_one(): void
    {
        $customer = $this->createCustomer();
        $this->actingAs($customer, 'sanctum');

        $placed = $this->order($this->createProduct())->assertOk()
            ->assertJsonPath('order.paid_at', null)
            ->assertJsonPath('order.invoice_number', null)
            ->json('order');

        $this->assertEqualsCanonicalizing(array_keys($placed), array_keys($this->getJson("/api/orders/{$placed['id']}")->json()));
    }

    public function test_free_delivery_applies_on_the_server(): void
    {
        $product = $this->createProduct(['cena' => 150]);

        $this->order($product, ['cart_items' => $this->oneLine($product, 2)])->assertOk();

        $this->assertSame('0.00', Order::sole()->delivery_price);
        $this->assertSame('300.00', Order::sole()->total_amount);
    }

    public function test_short_stock_gets_a_422_under_errors_cart_and_writes_nothing(): void
    {
        $product = $this->createProduct([], 1);

        $response = $this->order($product, ['cart_items' => $this->oneLine($product, 2)]);

        $response->assertStatus(422)->assertJsonValidationErrors(['cart']);
        $this->assertStringContainsString('1 szt.', $response->json('errors.cart.0'));
        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_status_events', 0);
        $this->assertSame(1, $this->variantOf($product)->stock);
    }

    public function test_one_bad_line_leaves_the_stock_of_the_good_lines_alone(): void
    {
        $good = $this->createProduct([], 5);
        $bad = $this->createProduct(['nazwa' => 'Wyprzedany'], 0);

        $this->order($good, ['cart_items' => [...$this->oneLine($good, 1), ...$this->oneLine($bad, 1)]])
            ->assertStatus(422)->assertJsonValidationErrors(['cart']);

        $this->assertSame(5, $this->variantOf($good)->stock);
    }

    public function test_two_lines_of_one_variant_are_checked_as_their_sum(): void
    {
        $product = $this->createProduct([], 3);

        $this->order($product, ['cart_items' => [...$this->oneLine($product, 2), ...$this->oneLine($product, 2)]])
            ->assertStatus(422);

        $this->assertSame(3, $this->variantOf($product)->stock);
    }

    public function test_order_of_the_last_piece_succeeds_and_the_next_is_refused(): void
    {
        $product = $this->createProduct([], 1);

        $this->order($product)->assertOk();
        $this->order($product, ['email' => 'second@example.com'])->assertStatus(422)->assertJsonValidationErrors(['cart']);

        $this->assertSame(0, $this->variantOf($product)->stock);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_stock_is_read_when_the_order_is_placed_not_when_it_was_quoted(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 2);
        $service = app(OrderService::class);

        $quote = app(CartPricing::class)->quote($this->checkout($product, 2)['items']);
        $this->assertTrue($quote['lines'][0]['available']);

        $service->place($customer, $this->checkout($product, 2));

        $this->expectException(ValidationException::class);
        $service->place($customer, $this->checkout($product, 2));
    }

    public function test_guarded_decrement_stops_a_race_the_stock_check_did_not_see(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 1);
        $variant = $this->variantOf($product);

        // A rival order commits between the locked read and the update.
        $pricing = new class extends CartPricing {
            public int $variantId;

            public function quote(array $items, ?string $coupon = null, ?string $deliveryMethod = null, bool $lock = false): array
            {
                $quote = parent::quote($items, $coupon, $deliveryMethod, $lock);
                ProductVariant::whereKey($this->variantId)->update(['stock' => 0]);

                return $quote;
            }
        };
        $pricing->variantId = $variant->id;

        try {
            (new OrderService($pricing))->place($customer, $this->checkout($product));
            $this->fail('The second buyer of the last piece must be refused.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('cart', $e->errors());
        }

        // The rollback also undoes the simulated rival's write: only no order may remain.
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
    }

    public function test_placing_asks_for_a_locking_read_of_the_stock(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();

        // sqlite compiles lockForUpdate to nothing, so the request for it is what can be observed.
        $pricing = new class extends CartPricing {
            public array $lockFlags = [];

            public function quote(array $items, ?string $coupon = null, ?string $deliveryMethod = null, bool $lock = false): array
            {
                $this->lockFlags[] = $lock;

                return parent::quote($items, $coupon, $deliveryMethod, $lock);
            }
        };

        (new OrderService($pricing))->place($customer, $this->checkout($product));

        $this->assertSame([true], $pricing->lockFlags);
    }

    public function test_placing_empties_the_customers_saved_cart(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        CartItem::create(['customer_id' => $customer->id, 'product_id' => $product->id, 'size' => 'M', 'color' => 'Czarny', 'quantity' => 1]);

        $this->actingAs($customer, 'sanctum');
        $this->order($product)->assertOk();

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_a_price_changed_after_the_cart_was_filled_is_charged_at_the_new_price(): void
    {
        $product = $this->createProduct(['cena' => 100]);
        $product->update(['cena' => 200]);

        $this->order($product)->assertOk();

        $this->assertSame('200.00', Order::sole()->subtotal_amount);
        $this->assertSame('200.00', Order::sole()->items->sole()->price);
    }

    public function test_inactive_product_cannot_be_ordered(): void
    {
        $product = $this->createProduct(['is_active' => false]);

        $this->order($product)->assertStatus(422)->assertJsonValidationErrors(['cart']);
    }

    public function test_more_than_100_cart_lines_are_rejected(): void
    {
        $product = $this->createProduct();
        $lines = array_fill(0, 101, $this->oneLine($product, 1)[0]);

        $this->order($product, ['cart_items' => $lines])->assertStatus(422)->assertJsonValidationErrors(['cart_items']);
    }

    // Checkout rules

    public function test_cash_is_accepted_only_with_store_pickup(): void
    {
        $product = $this->createProduct();

        foreach (['courier', 'pickup_point'] as $delivery) {
            $this->order($product, ['payment_method' => 'cash', 'delivery_method' => $delivery, 'pickup_point' => 'WAW01M'])
                ->assertStatus(422)->assertJsonValidationErrors(['payment_method']);
        }

        $this->order($product, ['payment_method' => 'cash', 'delivery_method' => 'store_pickup'])->assertOk();
    }

    public function test_pickup_point_delivery_needs_a_code_from_config(): void
    {
        $product = $this->createProduct();

        $this->order($product, ['delivery_method' => 'pickup_point'])
            ->assertStatus(422)->assertJsonValidationErrors(['pickup_point']);
        $this->order($product, ['delivery_method' => 'pickup_point', 'pickup_point' => 'NIEMA'])
            ->assertStatus(422)->assertJsonValidationErrors(['pickup_point']);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_pickup_point_is_stored_in_the_shipping_address(): void
    {
        $this->order($this->createProduct(), ['delivery_method' => 'pickup_point', 'pickup_point' => 'KRK04A'])->assertOk();

        $this->assertSame(
            ['code' => 'KRK04A', 'address' => 'ul. Ogrodowa 7, 30-002 Kraków'],
            Order::sole()->shipping_address['pickup_point']
        );
    }

    public function test_shipping_address_copies_billing_by_default(): void
    {
        $this->order($this->createProduct())->assertOk();

        $order = Order::sole();
        $this->assertSame('Nowa 2', $order->shipping_address['address']);
        $this->assertSame($order->billing_address['city'], $order->shipping_address['city']);
    }

    public function test_separate_shipping_address_is_stored_and_billing_is_kept(): void
    {
        $this->order($this->createProduct(), ['shipping' => [
            'first_name' => 'Ewa',
            'last_name' => 'Nowak',
            'address' => 'Dostawcza 9',
            'city' => 'Gdańsk',
            'postal_code' => '80-001',
            'country' => 'Polska',
        ]])->assertOk();

        $order = Order::sole();
        $this->assertSame('Dostawcza 9', $order->shipping_address['address']);
        $this->assertSame('Ewa', $order->shipping_address['first_name']);
        $this->assertSame('Nowa 2', $order->billing_address['address']);
    }

    public function test_incomplete_shipping_address_is_rejected(): void
    {
        $this->order($this->createProduct(), ['shipping' => ['first_name' => 'Ewa']])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['shipping.last_name', 'shipping.address', 'shipping.city']);
    }

    public function test_company_customer_needs_a_name_and_nip(): void
    {
        $product = $this->createProduct();

        $this->order($product, ['customer_type' => 'company'])
            ->assertStatus(422)->assertJsonValidationErrors(['company_name', 'nip']);

        $this->order($product, ['customer_type' => 'company', 'company_name' => 'Firma', 'nip' => '1234567890'])
            ->assertOk();

        $this->assertSame('1234567890', Order::sole()->billing_address['nip']);
    }

    // Reading

    public function test_orders_list_is_paginated_with_products_images_and_events(): void
    {
        $customer = $this->createCustomer();
        $this->actingAs($customer, 'sanctum');
        $this->order($this->createProduct())->assertOk();

        $response = $this->getJson('/api/orders')->assertOk()->assertJsonPath('total', 1);

        $response->assertJsonStructure(['data' => [['items' => [['product' => ['nazwa', 'images']]], 'status_events']]]);
        $this->assertArrayNotHasKey('opis', $response->json('data.0.items.0.product'));
    }

    public function test_orders_list_query_count_does_not_grow(): void
    {
        config(['shop.open_orders.per_customer' => 100]);
        $customer = $this->createCustomer();
        $this->actingAs($customer, 'sanctum');
        $product = $this->createProduct();
        $this->order($product)->assertOk();
        $one = $this->countQueries(fn () => $this->getJson('/api/orders')->assertOk());

        for ($i = 0; $i < 5; $i++) {
            $this->order($this->createProduct(['nazwa' => "Produkt {$i}"]))->assertOk();
        }

        $this->assertSame($one, $this->countQueries(fn () => $this->getJson('/api/orders')->assertOk()));
    }

    public function test_orders_of_others_stay_out_of_the_list(): void
    {
        $this->order($this->createProduct())->assertOk();
        $this->app['auth']->forgetGuards();

        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->getJson('/api/orders')->assertJsonPath('total', 0);
    }

    public function test_a_foreign_order_cannot_be_read(): void
    {
        $this->order($this->createProduct())->assertOk();
        $this->app['auth']->forgetGuards();
        $order = Order::sole();

        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->getJson("/api/orders/{$order->id}")->assertForbidden()->assertExactJson(['message' => 'Brak dostępu']);
    }

    public function test_guests_cannot_reach_order_routes(): void
    {
        $this->order($this->createProduct())->assertOk();
        $this->app['auth']->forgetGuards();
        $order = Order::sole();

        $this->getJson('/api/orders')->assertUnauthorized();
        $this->getJson("/api/orders/{$order->id}")->assertUnauthorized();
        $this->postJson("/api/orders/{$order->id}/cancel")->assertUnauthorized();
    }

    // Status flow

    private function placedOrder(Customer $customer, Product $product, int $quantity = 1): Order
    {
        return app(OrderService::class)->place($customer, $this->checkout($product, $quantity));
    }

    public function test_owner_can_cancel_a_pending_order_and_gets_the_stock_back(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 5);
        $order = $this->placedOrder($customer, $product, 2);
        $this->assertSame(3, $this->variantOf($product)->stock);

        $this->actingAs($customer, 'sanctum')->postJson("/api/orders/{$order->id}/cancel")->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('status_label', 'Anulowane')
            ->assertJsonPath('next_statuses', [])
            ->assertJsonPath('status_events.1.status', 'cancelled');

        $this->assertSame(5, $this->variantOf($product)->stock);
    }

    public function test_cancelling_a_product_without_options_returns_its_stock(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct(['rozmiar' => [], 'kolor' => []], 2);
        $checkout = $this->checkout($product);
        $checkout['items'][0]['size'] = null;
        $checkout['items'][0]['color'] = null;
        $order = app(OrderService::class)->place($customer, $checkout);
        $this->assertSame(1, $this->variantOf($product, '', '')->stock);

        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->assertSame(2, $this->variantOf($product, '', '')->stock);
    }

    public function test_cancelling_twice_returns_the_stock_once(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 5);
        $order = $this->placedOrder($customer, $product, 2);
        $this->actingAs($customer, 'sanctum');

        $this->postJson("/api/orders/{$order->id}/cancel")->assertOk();
        $this->postJson("/api/orders/{$order->id}/cancel")->assertStatus(422)->assertJsonValidationErrors(['status']);

        $this->assertSame(5, $this->variantOf($product)->stock);
    }

    public function test_a_stale_order_cannot_return_the_stock_twice(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 5);
        $stale = $this->placedOrder($customer, $product, 2);
        $service = app(OrderService::class);

        $service->changeStatus(Order::findOrFail($stale->id), 'cancelled');
        $this->assertSame('pending', $stale->status);

        try {
            $service->changeStatus($stale, 'cancelled');
            $this->fail('The second cancellation must be refused.');
        } catch (ValidationException) {
            $this->assertSame(5, $this->variantOf($product)->stock);
        }
    }

    public function test_only_a_pending_order_can_be_cancelled_by_its_owner(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct([], 5);
        $order = $this->placedOrder($customer, $product);
        app(OrderService::class)->changeStatus($order, 'processing');

        $this->actingAs($customer, 'sanctum')->postJson("/api/orders/{$order->id}/cancel")
            ->assertStatus(422)->assertJsonValidationErrors(['status']);

        $this->assertSame('processing', $order->fresh()->status);
        $this->assertSame(4, $this->variantOf($product)->stock);
    }

    public function test_a_foreign_order_cannot_be_cancelled(): void
    {
        $order = $this->placedOrder($this->createCustomer(), $this->createProduct());

        $this->actingAs($this->createCustomer(['email' => 'other@example.com']), 'sanctum')
            ->postJson("/api/orders/{$order->id}/cancel")->assertForbidden();

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_legal_transitions_walk_the_whole_flow_and_record_events(): void
    {
        $order = $this->placedOrder($this->createCustomer(), $this->createProduct());
        $service = app(OrderService::class);

        foreach (['processing', 'shipped', 'delivered'] as $status) {
            $service->changeStatus($order, $status, "Do {$status}");
        }

        $this->assertSame('delivered', $order->fresh()->status);
        $this->assertSame(
            ['pending', 'processing', 'shipped', 'delivered'],
            $order->statusEvents()->pluck('status')->all()
        );
        $this->assertSame('Do shipped', $order->statusEvents()->where('status', 'shipped')->value('note'));
        $this->assertSame([], $order->fresh()->next_statuses);
    }

    public function test_illegal_transitions_are_refused(): void
    {
        $service = app(OrderService::class);
        $customer = $this->createCustomer();
        $product = $this->createProduct();

        $illegal = [
            'pending' => ['shipped', 'delivered', 'pending'],
            'processing' => ['pending', 'delivered'],
            'shipped' => ['cancelled', 'processing'],
            'delivered' => ['cancelled', 'shipped'],
            'cancelled' => ['pending', 'processing'],
        ];

        foreach ($illegal as $from => $targets) {
            foreach ($targets as $to) {
                $order = $this->placedOrder($customer, $product);
                DB::table('orders')->where('id', $order->id)->update(['status' => $from]);

                try {
                    $service->changeStatus($order, $to);
                    $this->fail("{$from} to {$to} must be refused.");
                } catch (ValidationException $e) {
                    $this->assertArrayHasKey('status', $e->errors());
                }
            }
        }
    }

    public function test_cancelling_a_paid_order_marks_it_refunded(): void
    {
        $order = $this->placedOrder($this->createCustomer(), $this->createProduct());
        DB::table('orders')->where('id', $order->id)->update(['payment_status' => 'paid', 'status' => 'processing']);

        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->assertSame('refunded', $order->fresh()->payment_status);
    }

    public function test_cancelling_after_the_variant_was_removed_still_works(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $order = $this->placedOrder($customer, $product);
        $this->variantOf($product)->delete();

        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->assertSame('cancelled', $order->fresh()->status);
    }

    // Migration

    public function test_order_appends_have_no_icon_accessors(): void
    {
        $order = $this->placedOrder($this->createCustomer(), $this->createProduct());

        $this->assertArrayNotHasKey('payment_method_icon', $order->toArray());
        $this->assertFalse(method_exists(Order::class, 'getPaymentMethodIconAttribute'));
        $this->assertFalse(method_exists(Order::class, 'getDeliveryMethodIconAttribute'));
    }

    public function test_server_side_money_fields_cannot_be_mass_assigned(): void
    {
        $order = new Order(['payment_status' => 'paid', 'paid_at' => now(), 'invoice_number' => 'FV/X']);

        $this->assertSame('unpaid', $order->payment_status);
        $this->assertNull($order->paid_at);
        $this->assertNull($order->invoice_number);
        $this->assertFalse((new ProductVariant(['stock' => 5]))->isDirty('stock'));
    }
}
