<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Review;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, CountsQueries, RefreshDatabase;

    // A valid 1x1 image of each allowed type. No GD is needed to build or read them.
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private const JPEG = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

    private const WEBP = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

    private Customer $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->createAdmin();
        $this->actingAs($this->admin, 'sanctum');
    }

    private function placeOrder(Customer $customer, ?Product $product = null, string $method = 'transfer'): Order
    {
        return app(OrderService::class)->place($customer, [
            'items' => [['product_id' => ($product ?? $this->createProduct())->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => $method,
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => $method],
        ]);
    }

    private function productBody(array $overrides = []): array
    {
        return array_merge([
            'nazwa' => 'Nowa kurtka',
            'kategoria' => 'Kurtki',
            'cena' => 199.99,
            'opis' => 'Opis',
            'variants' => [
                ['size' => 'M', 'color' => 'Czarny', 'stock' => 4],
                ['size' => 'L', 'color' => 'Biały', 'stock' => 0],
            ],
        ], $overrides);
    }

    // Stats

    public function test_stats_sum_paid_orders_and_list_low_stock(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct(['nazwa' => 'Niski stan'], 3);
        $paid = $this->placeOrder($customer, $product);
        app(OrderService::class)->markPaid($paid);
        $this->placeOrder($customer);

        $response = $this->getJson('/api/admin/stats')->assertOk()
            ->assertJsonPath('revenue', 116.49)
            ->assertJsonPath('orders_count', 2)
            ->assertJsonPath('orders_by_status.pending', 1)
            ->assertJsonPath('orders_by_status.processing', 1)
            ->assertJsonPath('orders_by_status.cancelled', 0)
            ->assertJsonPath('low_stock_count', 1)
            ->assertJsonPath('low_stock.0.stock', 2)
            ->assertJsonPath('low_stock.0.product.nazwa', 'Niski stan');

        $this->assertArrayNotHasKey('opis', $response->json('low_stock.0.product'));
    }

    public function test_refunded_orders_leave_the_revenue(): void
    {
        $order = $this->placeOrder($this->createCustomer());
        app(OrderService::class)->markPaid($order);
        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->getJson('/api/admin/stats')->assertJsonPath('revenue', 0);
    }

    // Products

    public function test_product_list_includes_inactive_and_searches_with_escaping(): void
    {
        $this->createProduct(['nazwa' => 'Ukryta 100%', 'is_active' => false]);
        $this->createProduct(['nazwa' => 'Widoczna', 'kategoria' => 'Inne']);

        $this->getJson('/api/admin/products')->assertOk()->assertJsonPath('total', 2);
        $this->getJson('/api/admin/products?q=' . rawurlencode('%'))
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.is_active', false)
            ->assertJsonMissingPath('data.0.opis');
    }

    public function test_admin_product_detail_reaches_inactive_products(): void
    {
        $product = $this->createProduct(['is_active' => false]);

        $this->getJson("/api/admin/products/{$product->id}")->assertOk()
            ->assertJsonPath('opis', 'Opis produktu')
            ->assertJsonCount(4, 'variants');
    }

    public function test_create_derives_options_from_variants(): void
    {
        $response = $this->postJson('/api/admin/products', $this->productBody())->assertCreated()
            ->assertJsonPath('rozmiar', ['M', 'L'])
            ->assertJsonPath('kolor', ['Czarny', 'Biały'])
            ->assertJsonPath('stock_total', 4);

        $this->assertDatabaseHas('product_variants', ['product_id' => $response->json('id'), 'size' => 'M', 'stock' => 4]);
    }

    public function test_a_new_product_can_be_bought(): void
    {
        $id = $this->postJson('/api/admin/products', $this->productBody())->assertCreated()->json('id');

        $this->postJson('/api/cart/quote', ['items' => [['product_id' => $id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']]])
            ->assertJsonPath('lines.0.available', true);
    }

    public function test_put_syncs_variants_and_options(): void
    {
        $product = $this->createProduct(['rozmiar' => ['S', 'M'], 'kolor' => ['Czarny']], 5);
        $keptId = $this->variantOf($product, 'M')->id;

        $this->putJson("/api/admin/products/{$product->id}", ['variants' => [
            ['size' => 'M', 'color' => 'Czarny', 'stock' => 9],
            ['size' => 'XL', 'color' => 'Czarny', 'stock' => 1],
        ]])->assertOk()
            ->assertJsonPath('rozmiar', ['M', 'XL'])
            ->assertJsonPath('stock_total', 10)
            ->assertJsonCount(2, 'variants');

        $this->assertSame(9, $this->variantOf($product, 'M')->stock);
        $this->assertSame($keptId, $this->variantOf($product, 'M')->id);
        $this->assertDatabaseMissing('product_variants', ['product_id' => $product->id, 'size' => 'S']);
    }

    public function test_admin_can_mark_a_product_new_and_unmark_it(): void
    {
        $product = $this->createProduct();

        $this->putJson("/api/admin/products/{$product->id}", ['is_new' => true])->assertOk()->assertJsonPath('is_new', true);
        $this->getJson('/api/admin/products')->assertJsonPath('data.0.is_new', true);
        $this->putJson("/api/admin/products/{$product->id}", ['is_new' => false])->assertOk()->assertJsonPath('is_new', false);
        $this->putJson("/api/admin/products/{$product->id}", ['is_new' => 'nowy'])->assertStatus(422);
    }

    public function test_a_created_product_is_not_new_unless_asked(): void
    {
        $this->postJson('/api/admin/products', $this->productBody())->assertCreated()->assertJsonPath('is_new', false);
        $this->postJson('/api/admin/products', $this->productBody(['is_new' => true]))->assertCreated()->assertJsonPath('is_new', true);
    }

    public function test_put_without_variants_leaves_them_alone(): void
    {
        $product = $this->createProduct([], 5);

        $this->putJson("/api/admin/products/{$product->id}", ['cena' => 55.5, 'is_active' => false])->assertOk()
            ->assertJsonPath('cena', '55.50')
            ->assertJsonPath('is_active', false)
            ->assertJsonCount(4, 'variants');
    }

    public function test_put_ignores_counters_and_unknown_fields(): void
    {
        $product = $this->createProduct();

        $this->putJson("/api/admin/products/{$product->id}", ['reviews_count' => 999, 'ocena' => 5, 'id' => 77])->assertOk();

        $fresh = $product->fresh();
        $this->assertSame(0, $fresh->reviews_count);
        $this->assertSame('4.5', $fresh->ocena);
    }

    public function test_variants_with_empty_options_are_stored_as_empty_strings(): void
    {
        $this->postJson('/api/admin/products', $this->productBody(['variants' => [['size' => null, 'color' => '', 'stock' => 2]]]))
            ->assertCreated()
            ->assertJsonPath('rozmiar', [])
            ->assertJsonPath('kolor', [])
            ->assertJsonPath('variants.0.size', '');
    }

    public static function badVariants(): array
    {
        return [
            'none' => [[], 'variants'],
            'negative stock' => [[['size' => 'M', 'color' => '', 'stock' => -1]], 'variants.0.stock'],
            'no stock' => [[['size' => 'M', 'color' => '']], 'variants.0.stock'],
            'exact duplicate' => [[['size' => 'M', 'color' => '', 'stock' => 1], ['size' => 'M', 'color' => '', 'stock' => 2]], 'variants'],
            'differs only in case' => [[['size' => 'm', 'color' => '', 'stock' => 1], ['size' => 'M', 'color' => '', 'stock' => 2]], 'variants'],
        ];
    }

    #[DataProvider('badVariants')]
    public function test_bad_variants_are_refused(array $variants, string $field): void
    {
        $this->postJson('/api/admin/products', $this->productBody(['variants' => $variants]))
            ->assertStatus(422)->assertJsonValidationErrors([$field]);

        $this->assertDatabaseCount('products', 0);
    }

    public function test_product_with_orders_is_deactivated_not_deleted(): void
    {
        $product = $this->createProduct();
        $this->placeOrder($this->createCustomer(), $product);

        $this->deleteJson("/api/admin/products/{$product->id}")->assertOk()->assertJsonPath('deleted', false);

        $this->assertFalse($product->fresh()->is_active);
    }

    public function test_product_without_orders_is_deleted_with_its_files(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/a.jpg', 'x');
        $product = $this->createProduct();
        ProductImage::create(['product_id' => $product->id, 'image_path' => 'a.jpg', 'order' => 0]);

        $this->deleteJson("/api/admin/products/{$product->id}")->assertOk()->assertJsonPath('deleted', true);

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
        Storage::disk('public')->assertMissing('products/a.jpg');
    }

    // Images

    public static function validImages(): array
    {
        return [
            'png' => ['photo.png', self::PNG, 'png'],
            'jpeg' => ['photo.jpeg', self::JPEG, 'jpg'],
            'webp' => ['photo.webp', self::WEBP, 'webp'],
        ];
    }

    private function upload(Product $product, string $name, string $bytes): TestResponse
    {
        return $this->post(
            "/api/admin/products/{$product->id}/images",
            ['image' => UploadedFile::fake()->createWithContent($name, $bytes)],
            ['Accept' => 'application/json']
        );
    }

    #[DataProvider('validImages')]
    public function test_valid_images_are_stored_under_a_random_name(string $name, string $base64, string $extension): void
    {
        Storage::fake('public');
        $product = $this->createProduct();

        $response = $this->upload($product, $name, base64_decode($base64))->assertCreated();

        $path = $response->json('image_path');
        $this->assertMatchesRegularExpression('/\A[A-Za-z0-9]{40}\.' . $extension . '\z/', $path);
        Storage::disk('public')->assertExists("products/{$path}");
    }

    public function test_the_extension_comes_from_the_content_not_the_client(): void
    {
        Storage::fake('public');
        $product = $this->createProduct();

        // PNG bytes under a jpg name: the detected type decides what is stored.
        $response = $this->upload($product, 'photo.jpg', base64_decode(self::PNG))->assertCreated();

        $this->assertStringEndsWith('.png', $response->json('image_path'));
    }

    public function test_images_are_numbered_in_upload_order(): void
    {
        Storage::fake('public');
        $product = $this->createProduct();

        $first = $this->upload($product, 'a.png', base64_decode(self::PNG))->json('order');
        $second = $this->upload($product, 'b.png', base64_decode(self::PNG))->json('order');

        $this->assertSame($first + 1, $second);
    }

    public static function forbiddenUploads(): array
    {
        return [
            'php as php' => ['shell.php', '<?php system($_GET["c"]); ?>'],
            'php as jpg' => ['shell.jpg', '<?php system($_GET["c"]); ?>'],
            'php double extension' => ['shell.php.jpg', '<?php system($_GET["c"]); ?>'],
            'svg' => ['logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
            'svg as png' => ['logo.png', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
            'html as jpg' => ['page.jpg', '<html><script>alert(1)</script></html>'],
            'gif' => ['anim.gif', "GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"],
            'gif as jpg' => ['anim.jpg', "GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"],
            'truncated jpeg header' => ['bad.jpg', "\xFF\xD8\xFF\xE0"],
            'empty' => ['empty.jpg', ''],
        ];
    }

    #[DataProvider('forbiddenUploads')]
    public function test_files_that_are_not_allowed_images_are_refused(string $name, string $bytes): void
    {
        Storage::fake('public');
        $product = $this->createProduct();

        $this->upload($product, $name, $bytes)->assertStatus(422)->assertJsonValidationErrors(['image']);

        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('product_images', 0);
    }

    public function test_upload_over_5_mb_is_refused(): void
    {
        Storage::fake('public');

        $this->upload($this->createProduct(), 'big.png', base64_decode(self::PNG) . str_repeat("\0", 5 * 1024 * 1024 + 1))
            ->assertStatus(422)->assertJsonValidationErrors(['image']);
    }

    public function test_image_claiming_huge_dimensions_is_refused_without_decoding(): void
    {
        Storage::fake('public');
        // A PNG header declaring 30000x30000 pixels.
        $bytes = "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" . pack('NN', 30000, 30000) . "\x08\x06\x00\x00\x00" . str_repeat("\0", 64);

        $this->upload($this->createProduct(), 'bomb.png', $bytes)
            ->assertStatus(422)->assertJsonValidationErrors(['image']);
    }

    public function test_upload_without_a_file_is_refused(): void
    {
        $this->postJson("/api/admin/products/{$this->createProduct()->id}/images", [])
            ->assertStatus(422)->assertJsonValidationErrors(['image']);
    }

    public function test_image_can_be_deleted_with_its_file(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('products/a.jpg', 'x');
        $product = $this->createProduct();
        $image = ProductImage::create(['product_id' => $product->id, 'image_path' => 'a.jpg', 'order' => 0]);

        $this->deleteJson("/api/admin/products/{$product->id}/images/{$image->id}")->assertOk();

        $this->assertDatabaseCount('product_images', 0);
        Storage::disk('public')->assertMissing('products/a.jpg');
    }

    public function test_image_of_another_product_cannot_be_deleted_through_this_one(): void
    {
        $product = $this->createProduct();
        $other = $this->createProduct(['nazwa' => 'Inny']);
        $image = ProductImage::create(['product_id' => $other->id, 'image_path' => 'a.jpg', 'order' => 0]);

        $this->deleteJson("/api/admin/products/{$product->id}/images/{$image->id}")->assertNotFound();

        $this->assertDatabaseCount('product_images', 1);
    }

    public function test_a_path_stored_in_a_row_cannot_leave_the_products_directory(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('secret.txt', 'x');
        $product = $this->createProduct();
        $image = ProductImage::create(['product_id' => $product->id, 'image_path' => '../secret.txt', 'order' => 0]);

        $this->deleteJson("/api/admin/products/{$product->id}/images/{$image->id}")->assertOk();

        Storage::disk('public')->assertExists('secret.txt');
    }

    // Orders

    public function test_order_list_filters_by_status_and_searches(): void
    {
        $anna = $this->createCustomer(['email' => 'anna@example.com', 'last_name' => 'Kowalska']);
        $piotr = $this->createCustomer(['email' => 'piotr@example.com', 'last_name' => 'Zieliński']);
        $first = $this->placeOrder($anna);
        $second = $this->placeOrder($piotr);
        app(OrderService::class)->markPaid($second);

        $this->getJson('/api/admin/orders')->assertOk()->assertJsonPath('total', 2);
        $this->getJson('/api/admin/orders?status=processing')->assertJsonPath('total', 1);
        $this->getJson('/api/admin/orders?q=kowalska')->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $first->id);
        $this->getJson("/api/admin/orders?q={$second->order_number}")->assertJsonPath('data.0.id', $second->id);
        $this->getJson('/api/admin/orders?q=' . rawurlencode('%'))->assertJsonPath('total', 0);
        $this->getJson('/api/admin/orders?status=nieznany')->assertStatus(422);
    }

    public function test_order_list_is_light(): void
    {
        $this->placeOrder($this->createCustomer());

        $this->getJson('/api/admin/orders')->assertOk()
            ->assertJsonPath('data.0.items_count', 1)
            ->assertJsonPath('data.0.customer.email', 'victim@example.com')
            ->assertJsonPath('data.0.status_label', 'Oczekuje na realizację')
            ->assertJsonMissingPath('data.0.billing_address')
            ->assertJsonMissingPath('data.0.payment_details');
    }

    public function test_admin_orders_query_budget_holds_for_a_full_page(): void
    {
        $customer = $this->createCustomer();
        $this->placeOrder($customer);
        $one = $this->countQueries(fn () => $this->getJson('/api/admin/orders')->assertOk());

        for ($i = 0; $i < 12; $i++) {
            $this->placeOrder($this->createCustomer(['email' => "c{$i}@example.com"]));
        }
        $many = $this->countQueries(fn () => $this->getJson('/api/admin/orders')->assertJsonCount(13, 'data'));

        $this->assertSame($one, $many);
        $this->assertLessThanOrEqual(4, $many);
    }

    public function test_order_detail_has_customer_items_and_events(): void
    {
        $order = $this->placeOrder($this->createCustomer());

        $this->getJson("/api/admin/orders/{$order->id}")->assertOk()
            ->assertJsonPath('customer.email', 'victim@example.com')
            ->assertJsonMissingPath('customer.password')
            ->assertJsonPath('items.0.product.nazwa', 'Kurtka testowa')
            ->assertJsonPath('status_events.0.status', 'pending');
    }

    public function test_status_can_be_moved_with_a_note(): void
    {
        $order = $this->placeOrder($this->createCustomer());

        $this->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'processing', 'note' => 'Pakujemy'])
            ->assertOk()
            ->assertJsonPath('status', 'processing')
            ->assertJsonPath('status_events.1.note', 'Pakujemy');
    }

    public function test_illegal_status_change_is_refused(): void
    {
        $order = $this->placeOrder($this->createCustomer());

        $this->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'wymyslony'])->assertStatus(422);

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_admin_cancellation_restores_stock(): void
    {
        $product = $this->createProduct([], 5);
        $order = $this->placeOrder($this->createCustomer(), $product);

        $this->patchJson("/api/admin/orders/{$order->id}/status", ['status' => 'cancelled'])->assertOk();

        $this->assertSame(5, $this->variantOf($product)->stock);
    }

    public function test_transfer_order_can_be_marked_paid_once(): void
    {
        $order = $this->placeOrder($this->createCustomer());

        $this->patchJson("/api/admin/orders/{$order->id}/payment")->assertOk()
            ->assertJsonPath('payment_status', 'paid')
            ->assertJsonPath('status', 'processing');

        $this->patchJson("/api/admin/orders/{$order->id}/payment")->assertStatus(409);
    }

    public function test_card_order_is_not_marked_paid_by_hand(): void
    {
        $order = $this->placeOrder($this->createCustomer(), null, 'card');

        $this->patchJson("/api/admin/orders/{$order->id}/payment")
            ->assertStatus(422)->assertJsonValidationErrors(['payment']);
    }

    // Customers

    public function test_customer_list_counts_orders_and_hides_secrets(): void
    {
        $customer = $this->createCustomer();
        $this->placeOrder($customer);

        $response = $this->getJson('/api/admin/customers?q=victim')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.orders_count', 1);

        $this->assertArrayNotHasKey('password', $response->json('data.0'));
    }

    public function test_customer_search_escapes_wildcards(): void
    {
        $this->createCustomer();

        $this->getJson('/api/admin/customers?q=' . rawurlencode('_'))->assertJsonPath('total', 0);
    }

    // Coupons

    public function test_coupon_crud(): void
    {
        $id = $this->postJson('/api/admin/coupons', [
            'code' => ' lato-20 ',
            'type' => 'percent',
            'value' => 20,
            'min_order' => 50,
            'max_uses' => 10,
            'expires_at' => '2030-01-01',
        ])->assertCreated()->assertJsonPath('code', 'LATO-20')->json('id');

        $this->getJson('/api/admin/coupons')->assertOk()->assertJsonPath('total', 1);
        $this->getJson("/api/admin/coupons/{$id}")->assertOk()->assertJsonPath('value', '20.00');

        $this->putJson("/api/admin/coupons/{$id}", ['is_active' => false])->assertOk()->assertJsonPath('is_active', false);

        $this->deleteJson("/api/admin/coupons/{$id}")->assertOk();
        $this->assertDatabaseCount('coupons', 0);
    }

    public function test_a_new_coupon_has_every_field(): void
    {
        $this->postJson('/api/admin/coupons', ['code' => 'NOWY', 'type' => 'fixed', 'value' => 5])->assertCreated()
            ->assertJsonPath('min_order', '0.00')
            ->assertJsonPath('max_uses', null)
            ->assertJsonPath('expires_at', null);
    }

    public function test_coupon_code_is_unique_ignoring_case(): void
    {
        Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);

        $this->postJson('/api/admin/coupons', ['code' => 'witaj10', 'type' => 'percent', 'value' => 5])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
    }

    public function test_coupon_keeps_its_own_code_on_update(): void
    {
        $coupon = Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);

        $this->putJson("/api/admin/coupons/{$coupon->id}", ['code' => 'WITAJ10', 'value' => 15])->assertOk();
    }

    public static function badCoupons(): array
    {
        return [
            'percent over 100' => [['value' => 101], 'value'],
            'zero value' => [['value' => 0], 'value'],
            'unknown type' => [['type' => 'gratis'], 'type'],
            'bad characters' => [['code' => "X' OR '1"], 'code'],
            'max uses of zero' => [['max_uses' => 0], 'max_uses'],
            'bad date' => [['expires_at' => 'kiedyś'], 'expires_at'],
        ];
    }

    #[DataProvider('badCoupons')]
    public function test_bad_coupons_are_refused(array $overrides, string $field): void
    {
        $this->postJson('/api/admin/coupons', array_merge(['code' => 'DOBRY', 'type' => 'percent', 'value' => 10], $overrides))
            ->assertStatus(422)->assertJsonValidationErrors([$field]);
    }

    public function test_fixed_coupon_can_exceed_100(): void
    {
        $this->postJson('/api/admin/coupons', ['code' => 'DUZY', 'type' => 'fixed', 'value' => 500])->assertCreated();
    }

    public function test_used_count_cannot_be_set_through_the_api(): void
    {
        $coupon = Coupon::create(['code' => 'WITAJ10', 'type' => 'percent', 'value' => 10]);

        $this->putJson("/api/admin/coupons/{$coupon->id}", ['used_count' => 100])->assertOk();

        $this->assertSame(0, $coupon->fresh()->used_count);
    }

    // Reviews

    public function test_admin_can_delete_a_review_and_totals_follow(): void
    {
        $product = $this->createProduct();
        $first = Review::create(['product_id' => $product->id, 'customer_id' => $this->createCustomer()->id, 'rating' => 5]);
        Review::create(['product_id' => $product->id, 'customer_id' => $this->admin->id, 'rating' => 3]);
        app(\App\Services\ReviewService::class)->recalculate($product);
        $this->assertSame('4.0', $product->fresh()->ocena);

        $this->deleteJson("/api/admin/reviews/{$first->id}")->assertOk();

        $this->assertSame('3.0', $product->fresh()->ocena);
        $this->assertSame(1, $product->fresh()->reviews_count);
    }
}
