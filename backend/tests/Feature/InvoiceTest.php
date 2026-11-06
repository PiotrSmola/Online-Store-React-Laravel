<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Services\InvoiceService;
use App\Services\OrderService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, RefreshDatabase;

    private function paidOrder(?Customer $customer = null, array $overrides = []): Order
    {
        $order = $this->unpaidOrder($customer, $overrides);

        return app(OrderService::class)->markPaid($order);
    }

    private function unpaidOrder(?Customer $customer = null, array $overrides = []): Order
    {
        $product = $overrides['product'] ?? $this->createProduct(['cena' => 123]);

        return app(OrderService::class)->place($customer ?? $this->createCustomer(), array_merge([
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'store_pickup',
            'billing_address' => [
                'first_name' => 'Żaneta',
                'last_name' => 'Łącka',
                'company_name' => 'Firma <b>Gęś</b>',
                'nip' => '1234567890',
                'address' => 'Źródlana 1',
                'city' => 'Łódź',
                'postal_code' => '90-001',
            ],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
        ], array_diff_key($overrides, ['product' => true])));
    }


    public function test_owner_downloads_a_real_pdf_for_a_paid_order(): void
    {
        $customer = $this->createCustomer();
        $order = $this->paidOrder($customer);

        $response = $this->actingAs($customer, 'sanctum')->get("/api/orders/{$order->id}/invoice")->assertOk();

        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringStartsWith('attachment; filename="faktura-FV-', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_the_pdf_embeds_dejavu_sans_for_polish_letters(): void
    {
        $customer = $this->createCustomer();
        $order = $this->paidOrder($customer);

        $pdf = $this->actingAs($customer, 'sanctum')->get("/api/orders/{$order->id}/invoice")->getContent();

        $this->assertStringContainsString('DejaVuSans', $pdf);
    }

    public function test_numbers_keep_counting_past_9999_in_a_month(): void
    {
        $this->travelTo('2026-03-15 12:00:00');
        $customer = $this->createCustomer();
        $service = app(InvoiceService::class);

        // In text order FV/2026/03/9999 sorts after FV/2026/03/10000.
        foreach ([9999, 10000] as $sequence) {
            $order = $this->paidOrder($customer);
            DB::table('orders')->where('id', $order->id)->update([
                'invoice_number' => "FV/2026/03/{$sequence}",
                'invoice_sequence' => $sequence,
            ]);
        }

        $this->assertSame('FV/2026/03/10001', $service->ensureNumber($this->paidOrder($customer)));
    }

    public function test_a_refunded_order_keeps_access_to_its_issued_invoice(): void
    {
        $customer = $this->createCustomer();
        $order = $this->paidOrder($customer);
        $number = app(InvoiceService::class)->ensureNumber($order);
        app(OrderService::class)->changeStatus($order, 'cancelled');
        $this->assertSame('refunded', $order->fresh()->payment_status);

        $response = $this->actingAs($customer, 'sanctum')->get("/api/orders/{$order->id}/invoice")->assertOk();

        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertSame($number, $order->fresh()->invoice_number);
    }

    public function test_a_refunded_order_without_an_invoice_does_not_get_one(): void
    {
        $customer = $this->createCustomer();
        $order = $this->paidOrder($customer);
        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->actingAs($customer, 'sanctum')->getJson("/api/orders/{$order->id}/invoice")->assertStatus(409);

        $this->assertNull($order->fresh()->invoice_number);
    }

    public function test_the_invoice_says_when_the_payment_was_refunded(): void
    {
        $order = $this->paidOrder();
        app(OrderService::class)->changeStatus($order, 'cancelled');
        $order = $order->fresh();

        $data = ['number' => 'FV/1', 'order' => $order, 'seller' => config('shop.seller'), 'vatRate' => 23, 'rows' => [], 'totals' => ['net' => 0, 'vat' => 0, 'gross' => 0]];

        $this->assertStringContainsString('płatność została zwrócona', view('invoices.order', $data)->render());
    }

    public function test_a_renamed_product_does_not_change_what_was_invoiced(): void
    {
        $product = $this->createProduct(['nazwa' => 'Nazwa z dnia zakupu']);
        $order = $this->paidOrder(null, ['product' => $product]);

        $product->update(['nazwa' => 'Nowa nazwa']);

        $rows = app(InvoiceService::class)->amounts($order->fresh())['rows'];

        $this->assertStringContainsString('Nazwa z dnia zakupu', $rows[0]['name']);
    }

    public function test_order_history_keeps_the_name_from_the_purchase(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct(['nazwa' => 'Nazwa z dnia zakupu']);
        $order = $this->paidOrder($customer, ['product' => $product]);
        $product->update(['nazwa' => 'Nowa nazwa']);

        $this->actingAs($customer, 'sanctum')->getJson("/api/orders/{$order->id}")
            ->assertJsonPath('items.0.product_name', 'Nazwa z dnia zakupu')
            ->assertJsonPath('items.0.product.nazwa', 'Nowa nazwa');
    }

    public function test_the_sequence_stays_out_of_the_api(): void
    {
        $customer = $this->createCustomer();
        $order = $this->paidOrder($customer);
        app(InvoiceService::class)->ensureNumber($order);

        $this->actingAs($customer, 'sanctum')->getJson("/api/orders/{$order->id}")
            ->assertJsonMissingPath('invoice_sequence');
    }

    public function test_a_foreign_invoice_cannot_be_downloaded(): void
    {
        $order = $this->paidOrder($this->createCustomer());

        $this->actingAs($this->createCustomer(['email' => 'other@example.com']), 'sanctum')
            ->getJson("/api/orders/{$order->id}/invoice")
            ->assertForbidden();

        $this->assertNull($order->fresh()->invoice_number);
    }

    public function test_guest_cannot_download_an_invoice(): void
    {
        $order = $this->paidOrder();

        $this->getJson("/api/orders/{$order->id}/invoice")->assertUnauthorized();
    }

    public function test_unpaid_orders_have_no_invoice(): void
    {
        $customer = $this->createCustomer();
        $order = $this->unpaidOrder($customer);

        $this->actingAs($customer, 'sanctum')->getJson("/api/orders/{$order->id}/invoice")
            ->assertStatus(409)
            ->assertExactJson(['message' => 'Faktura jest dostępna po opłaceniu zamówienia.']);

        $this->assertNull($order->fresh()->invoice_number);
    }

    public function test_admin_can_download_any_paid_invoice(): void
    {
        $order = $this->paidOrder();
        $this->actingAs($this->createAdmin(), 'sanctum');

        $this->get("/api/admin/orders/{$order->id}/invoice")->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_number_is_created_when_first_needed_and_then_kept(): void
    {
        $this->travelTo('2026-03-15 12:00:00');
        $order = $this->paidOrder();
        $this->assertNull($order->fresh()->invoice_number);
        $service = app(InvoiceService::class);

        $this->assertSame('FV/2026/03/0001', $service->ensureNumber($order));
        $this->assertSame('FV/2026/03/0001', $service->ensureNumber(Order::findOrFail($order->id)));
        $this->assertSame('FV/2026/03/0001', $order->fresh()->invoice_number);
    }

    public function test_numbers_run_within_the_month_and_restart_in_the_next(): void
    {
        $service = app(InvoiceService::class);
        $customer = $this->createCustomer();

        $this->travelTo('2026-03-15 12:00:00');
        $this->assertSame('FV/2026/03/0001', $service->ensureNumber($this->paidOrder($customer)));
        $this->assertSame('FV/2026/03/0002', $service->ensureNumber($this->paidOrder($customer)));

        $this->travelTo('2026-04-01 12:00:00');
        $this->assertSame('FV/2026/04/0001', $service->ensureNumber($this->paidOrder($customer)));
    }

    private function failSavingWithDuplicateNumber(int $times): void
    {
        $failures = 0;

        Order::saving(function () use (&$failures, $times) {
            if ($failures++ < $times) {
                throw new UniqueConstraintViolationException('sqlite', 'update orders', [], new \PDOException('UNIQUE'));
            }
        });
    }

    public function test_losing_a_race_for_a_number_tries_again(): void
    {
        $this->travelTo('2026-03-15 12:00:00');
        $order = $this->paidOrder();
        $this->failSavingWithDuplicateNumber(2);

        $this->assertSame('FV/2026/03/0001', app(InvoiceService::class)->ensureNumber($order));
    }

    public function test_it_gives_up_after_a_few_attempts(): void
    {
        $order = $this->paidOrder();
        $this->failSavingWithDuplicateNumber(5);

        $this->expectException(UniqueConstraintViolationException::class);

        app(InvoiceService::class)->ensureNumber($order);
    }

    public function test_the_invoice_number_is_unique_in_the_database(): void
    {
        $customer = $this->createCustomer();
        $first = $this->paidOrder($customer);
        $second = $this->paidOrder($customer);
        DB::table('orders')->where('id', $first->id)->update(['invoice_number' => 'FV/2026/03/0001']);

        $this->expectException(UniqueConstraintViolationException::class);

        DB::table('orders')->where('id', $second->id)->update(['invoice_number' => 'FV/2026/03/0001']);
    }

    public function test_net_vat_and_gross_use_the_configured_rate(): void
    {
        $order = $this->paidOrder();
        $service = app(InvoiceService::class);

        $this->assertEquals(['net' => 100.0, 'vat' => 23.0, 'gross' => 123.0], $service->amounts($order)['totals']);

        config(['shop.vat_rate' => 8]);

        $this->assertEquals(['net' => 113.89, 'vat' => 9.11, 'gross' => 123.0], $service->amounts($order)['totals']);
    }

    public function test_rows_add_up_exactly_to_the_amount_paid(): void
    {
        Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);
        $order = $this->paidOrder(null, [
            'product' => $this->createProduct(['cena' => 33.33]),
            'coupon_code' => 'WITAJ10',
            'delivery_method' => 'courier',
        ]);

        $data = app(InvoiceService::class)->amounts($order);

        $this->assertCount(3, $data['rows']);
        $this->assertEqualsWithDelta((float) $order->total_amount, $data['totals']['gross'], 0.001);
        $this->assertEqualsWithDelta($data['totals']['gross'], $data['totals']['net'] + $data['totals']['vat'], 0.001);
        $this->assertEqualsWithDelta(array_sum(array_column($data['rows'], 'gross')), $data['totals']['gross'], 0.001);
        $this->assertLessThan(0, $data['rows'][1]['gross']);
        $this->assertStringContainsString('Dostawa', $data['rows'][2]['name']);
    }

    public function test_view_escapes_user_data_and_uses_dejavu(): void
    {
        $order = $this->paidOrder(null, ['product' => $this->createProduct(['nazwa' => '<script>alert(1)</script>'])]);
        $data = [
            'number' => 'FV/2026/03/0001',
            'order' => $order,
            'seller' => config('shop.seller'),
            'vatRate' => 23,
            'rows' => [['name' => $order->items[0]->product->nazwa, 'quantity' => 1, 'net' => 1, 'vat' => 0.23, 'gross' => 1.23]],
            'totals' => ['net' => 1, 'vat' => 0.23, 'gross' => 1.23],
        ];

        $html = view('invoices.order', $data)->render();

        $this->assertStringContainsString('"DejaVu Sans"', $html);
        $this->assertStringNotContainsString('<script>alert', $html);
        $this->assertStringNotContainsString('<b>Gęś</b>', $html);
        $this->assertStringContainsString('Firma &lt;b&gt;Gęś&lt;/b&gt;', $html);
        $this->assertStringContainsString('NIP: 1234567890', $html);
    }

    public function test_pdf_engine_keeps_php_and_remote_files_off(): void
    {
        $this->assertFalse(config('dompdf.options.enable_php') ?? config('dompdf.options.is_php_enabled'));
        $this->assertFalse(config('dompdf.options.enable_remote') ?? config('dompdf.options.is_remote_enabled'));
    }
}
