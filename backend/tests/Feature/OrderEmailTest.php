<?php

namespace Tests\Feature;

use App\Mail\OrderPlaced;
use App\Mail\OrderStatusChanged;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\OrderService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class OrderEmailTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function place(?Customer $customer = null, array $overrides = []): Order
    {
        $product = $overrides['product'] ?? $this->createProduct();

        return app(OrderService::class)->place($customer ?? $this->createCustomer(), array_merge([
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer', 'instructions' => 'Przelew na konto: 12 3456'],
        ], array_diff_key($overrides, ['product' => true])));
    }

    public function test_both_mailables_are_queued(): void
    {
        $this->assertContains(ShouldQueue::class, class_implements(OrderPlaced::class));
        $this->assertContains(ShouldQueue::class, class_implements(OrderStatusChanged::class));
    }

    public function test_placing_an_order_queues_a_confirmation_to_the_customer(): void
    {
        Mail::fake();

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertOk();

        Mail::assertQueued(OrderPlaced::class, fn (OrderPlaced $mail) => $mail->hasTo('new@example.com'));
        Mail::assertNotOutgoing(OrderStatusChanged::class);
    }

    public function test_a_failed_order_sends_nothing(): void
    {
        Mail::fake();
        OrderItem::creating(function () {
            throw new \RuntimeException('boom');
        });

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertStatus(500);

        Mail::assertNothingOutgoing();
    }

    public function test_an_order_refused_for_stock_sends_nothing(): void
    {
        Mail::fake();

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct([], 0)))->assertStatus(422);

        Mail::assertNothingOutgoing();
    }

    public function test_a_mail_failure_leaves_the_order_placed(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('smtp down new@example.com'));

        $this->postJson('/api/orders', $this->orderPayload($this->createProduct()))->assertOk();

        $this->assertDatabaseCount('orders', 1);
    }

    public function test_status_changes_queue_a_mail_with_the_note(): void
    {
        $order = $this->place();
        Mail::fake();

        app(OrderService::class)->changeStatus($order, 'processing', 'Pakujemy');

        Mail::assertQueued(OrderStatusChanged::class, fn (OrderStatusChanged $mail) => $mail->hasTo('victim@example.com')
            && $mail->note === 'Pakujemy'
            && $mail->order->status === 'processing');
    }

    public function test_a_refused_status_change_sends_nothing(): void
    {
        $order = $this->place();
        Mail::fake();

        $this->actingAs($order->customer, 'sanctum');
        $this->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'delivered'])->assertForbidden();

        Mail::assertNothingOutgoing();
    }

    public function test_cancellation_by_the_customer_queues_a_mail(): void
    {
        $order = $this->place();
        Mail::fake();

        $this->actingAs($order->customer, 'sanctum')->postJson("/api/orders/{$order->id}/cancel")->assertOk();

        Mail::assertQueued(OrderStatusChanged::class);
    }

    public function test_a_payment_queues_a_status_mail_and_a_decline_does_not(): void
    {
        $order = $this->place(null, ['payment_method' => 'card']);
        $this->actingAs($order->customer, 'sanctum');
        Mail::fake();

        $this->postJson("/api/orders/{$order->id}/pay", ['card_last_four' => '0002'])->assertStatus(402);
        Mail::assertNothingOutgoing();

        $this->postJson("/api/orders/{$order->id}/pay", ['card_last_four' => '4242'])->assertOk();
        Mail::assertQueued(OrderStatusChanged::class, 1);
    }

    public function test_confirmation_lists_the_order_in_polish(): void
    {
        Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);
        $order = $this->place(null, [
            'product' => $this->createProduct(['nazwa' => 'Żółta kurtka', 'cena' => 100]),
            'coupon_code' => 'WITAJ10',
        ]);

        $html = (new OrderPlaced($order))->render();

        $this->assertStringContainsString($order->order_number, $html);
        $this->assertStringContainsString('Żółta kurtka', $html);
        $this->assertStringContainsString('M, Czarny', $html);
        $this->assertStringContainsString('2 × 100,00 zł', $html);
        $this->assertStringContainsString('Rabat (WITAJ10): -20,00 zł', $html);
        $this->assertStringContainsString('Do zapłaty: 195,99 zł', $html);
        $this->assertStringContainsString('Przelew na konto: 12 3456', $html);
        $this->assertStringContainsString('Potwierdzenie zamówienia', (new OrderPlaced($order))->envelope()->subject);
    }

    public function test_status_mail_names_the_new_status(): void
    {
        $order = $this->place();
        app(OrderService::class)->changeStatus($order, 'processing');

        $html = (new OrderStatusChanged($order->fresh(), 'Pakujemy'))->render();

        $this->assertStringContainsString('W realizacji', $html);
        $this->assertStringContainsString('Pakujemy', $html);
    }

    public function test_mails_escape_values_that_came_from_users(): void
    {
        $order = $this->place(null, ['product' => $this->createProduct(['nazwa' => '<script>alert(1)</script>'])]);

        $placed = (new OrderPlaced($order))->render();
        $status = (new OrderStatusChanged($order, '<img src=x onerror=alert(1)>'))->render();

        $this->assertStringNotContainsString('<script>alert', $placed);
        $this->assertStringContainsString('&lt;script&gt;', $placed);
        $this->assertStringNotContainsString('<img src=x', $status);
    }

    public function test_no_view_prints_unescaped_data(): void
    {
        foreach (glob(resource_path('views/**/*.blade.php')) as $view) {
            $this->assertStringNotContainsString('{!!', file_get_contents($view), $view);
        }
    }
}
