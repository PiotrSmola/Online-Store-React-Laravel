<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class SimulatedPaymentTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = $this->createCustomer();
    }

    private function placeOrder(string $method = 'card', ?Customer $customer = null): Order
    {
        return app(OrderService::class)->place($customer ?? $this->customer, [
            'items' => [['product_id' => $this->createProduct()->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => $method,
            'delivery_method' => $method === 'cash' ? 'store_pickup' : 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => $method],
        ]);
    }

    private function pay(Order $order, string $lastFour = '4242'): TestResponse
    {
        return $this->actingAs($this->customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/pay", ['card_last_four' => $lastFour]);
    }

    public function test_accepted_card_pays_the_order_and_moves_it_to_processing(): void
    {
        $order = $this->placeOrder();

        $this->pay($order)->assertOk()
            ->assertJsonPath('payment_status', 'paid')
            ->assertJsonPath('payment_status_label', 'Opłacone')
            ->assertJsonPath('status', 'processing')
            ->assertJsonPath('status_events.1.status', 'processing')
            ->assertJsonPath('status_events.1.note', 'Płatność kartą przyjęta');

        $fresh = $order->fresh();
        $this->assertNotNull($fresh->paid_at);
        $this->assertSame('4242', $fresh->payment_details['card_last_four']);
    }

    public function test_declined_card_gets_402_in_polish_and_stays_saved_as_failed(): void
    {
        $order = $this->placeOrder();

        $response = $this->pay($order, '0002');

        $response->assertStatus(402)->assertJsonPath('order.payment_status', 'failed');
        $this->assertStringContainsString('odrzucona', $response->json('message'));

        $fresh = $order->fresh();
        $this->assertSame('failed', $fresh->payment_status);
        $this->assertSame('pending', $fresh->status);
        $this->assertNull($fresh->paid_at);
    }

    public function test_declined_payment_can_be_retried(): void
    {
        $order = $this->placeOrder();

        $this->pay($order, '0002')->assertStatus(402);
        $this->pay($order, '0002')->assertStatus(402);
        $this->pay($order)->assertOk()->assertJsonPath('payment_status', 'paid');

        $this->assertSame(1, $order->statusEvents()->where('status', 'processing')->count());
    }

    public function test_paying_twice_is_refused(): void
    {
        $order = $this->placeOrder();
        $this->pay($order)->assertOk();
        $paidAt = $order->fresh()->paid_at;
        $this->travel(1)->hour();

        $this->pay($order, '1111')->assertStatus(409)->assertExactJson(['message' => 'To zamówienie jest już opłacone.']);

        $fresh = $order->fresh();
        $this->assertSame('4242', $fresh->payment_details['card_last_four']);
        $this->assertEquals($paidAt, $fresh->paid_at);
        $this->assertSame(2, $fresh->statusEvents()->count());
    }

    public function test_a_declined_retry_cannot_undo_a_payment(): void
    {
        $order = $this->placeOrder();
        $this->pay($order)->assertOk();

        $this->pay($order, '0002')->assertStatus(409);

        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_a_request_holding_a_stale_order_cannot_pay_it_again(): void
    {
        $service = app(OrderService::class);
        $stale = $this->placeOrder();

        // Both requests loaded the unpaid order; this one reaches the lock first.
        $service->pay(Order::findOrFail($stale->id), '4242');
        $this->assertSame('unpaid', $stale->payment_status);

        try {
            $service->pay($stale, '1111');
            $this->fail('The second payment must be refused.');
        } catch (HttpResponseException $e) {
            $this->assertSame(409, $e->getResponse()->getStatusCode());
        }

        $this->assertSame('4242', $stale->fresh()->payment_details['card_last_four']);
        $this->assertSame(1, $stale->statusEvents()->where('note', 'Płatność kartą przyjęta')->count());
    }

    public function test_a_payment_racing_a_cancellation_loses(): void
    {
        $service = app(OrderService::class);
        $stale = $this->placeOrder();

        $service->changeStatus(Order::findOrFail($stale->id), 'cancelled');

        $this->expectException(HttpResponseException::class);
        $service->pay($stale, '4242');
    }

    public function test_cancelled_order_cannot_be_paid(): void
    {
        $order = $this->placeOrder();
        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->pay($order)->assertStatus(409);

        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_refunded_order_cannot_be_paid(): void
    {
        $order = $this->placeOrder();
        DB::table('orders')->where('id', $order->id)->update(['payment_status' => 'refunded']);

        $this->pay($order)->assertStatus(409);
    }

    public function test_transfer_and_cash_orders_cannot_be_paid_by_card(): void
    {
        foreach (['transfer', 'cash'] as $method) {
            $order = $this->placeOrder($method);

            $this->pay($order)->assertStatus(422)->assertJsonValidationErrors(['payment']);
            $this->assertSame('unpaid', $order->fresh()->payment_status);
        }
    }

    public function test_a_foreign_order_cannot_be_paid(): void
    {
        $order = $this->placeOrder('card', $this->createCustomer(['email' => 'other@example.com']));

        $this->pay($order)->assertForbidden();

        $this->assertSame('unpaid', $order->fresh()->payment_status);
    }

    public function test_a_foreign_order_is_refused_before_the_body_is_validated(): void
    {
        $order = $this->placeOrder('card', $this->createCustomer(['email' => 'other@example.com']));

        $this->actingAs($this->customer, 'sanctum')
            ->postJson("/api/orders/{$order->id}/pay", [])
            ->assertForbidden();
    }

    public function test_guest_cannot_pay(): void
    {
        $order = $this->placeOrder();

        $this->postJson("/api/orders/{$order->id}/pay", ['card_last_four' => '4242'])->assertUnauthorized();
    }

    public function test_payment_does_not_pull_back_an_order_already_moved_on(): void
    {
        $order = $this->placeOrder();
        app(OrderService::class)->changeStatus($order, 'processing');
        app(OrderService::class)->changeStatus($order, 'shipped');

        $this->pay($order)->assertOk()->assertJsonPath('status', 'shipped');
    }

    public function test_mark_paid_settles_transfer_and_cash(): void
    {
        foreach (['transfer', 'cash'] as $method) {
            $order = $this->placeOrder($method);

            $paid = app(OrderService::class)->markPaid($order);

            $this->assertSame('paid', $paid->payment_status);
            $this->assertSame('processing', $paid->status);
            $this->assertNotNull($paid->paid_at);
        }
    }

    public function test_mark_paid_refuses_card_orders_and_repeats(): void
    {
        $service = app(OrderService::class);

        try {
            $service->markPaid($this->placeOrder());
            $this->fail('Card orders are paid by the customer.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('payment', $e->errors());
        }

        $transfer = $this->placeOrder('transfer');
        $service->markPaid($transfer);

        $this->expectException(HttpResponseException::class);
        $service->markPaid($transfer);
    }

    public function test_server_error_during_payment_is_generic_and_rolled_back(): void
    {
        config(['app.debug' => false]);
        $order = $this->placeOrder();
        Order::saving(function () {
            throw new \RuntimeException('SQLSTATE secret');
        });

        $this->pay($order)->assertStatus(500)
            ->assertExactJson(['message' => 'Wystąpił błąd serwera. Spróbuj ponownie później.']);

        $this->assertSame('unpaid', Order::find($order->id)->payment_status);
    }
}
