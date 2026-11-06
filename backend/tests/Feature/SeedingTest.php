<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Review;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class SeedingTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    private function seedShop(): void
    {
        $this->artisan('shop:seed --local')->assertSuccessful();
    }

    private function useAdminEnv(?string $email, ?string $password): void
    {
        config(['shop.admin.email' => $email, 'shop.admin.password' => $password]);
    }

    public function test_every_product_gets_its_variants(): void
    {
        $this->seedShop();

        Product::with('variants')->lazyById()->each(function (Product $product) {
            $this->assertCount(count($product->optionCombinations()), $product->variants, $product->nazwa);
        });
    }

    public function test_stock_has_sold_out_and_low_variants_but_mostly_enough(): void
    {
        $this->seedShop();

        $this->assertGreaterThan(0, ProductVariant::where('stock', 0)->count());
        $this->assertGreaterThan(0, ProductVariant::whereBetween('stock', [1, 2])->count());
        $this->assertGreaterThan(ProductVariant::count() / 2, ProductVariant::where('stock', '>=', 3)->count());
    }

    public function test_stock_is_the_same_on_every_run(): void
    {
        $this->seedShop();
        $this->seedShop();

        $rows = ProductVariant::query()->orderBy('id')
            ->get(['size', 'color', 'stock'])
            ->map(fn ($variant) => "{$variant->size}|{$variant->color}|{$variant->stock}")
            ->all();

        [$first, $second] = array_chunk($rows, count($rows) / 2);

        $this->assertSame($first, $second);
    }

    public function test_both_coupons_exist_and_work_as_specified(): void
    {
        $this->seedShop();

        $welcome = Coupon::where('code', 'WITAJ10')->sole();
        $this->assertSame('percent', $welcome->type);
        $this->assertSame('10.00', $welcome->value);

        $minus = Coupon::where('code', 'MINUS20')->sole();
        $this->assertSame('fixed', $minus->type);
        $this->assertSame('20.00', $minus->value);
        $this->assertSame('150.00', $minus->min_order);
    }

    public function test_six_demo_customers_exist_with_random_passwords(): void
    {
        $this->seedShop();

        $customers = Customer::all();
        $this->assertCount(6, $customers);
        $this->assertFalse($customers->contains('is_admin', true));

        foreach (['password', 'demo', '12345678', 'secret'] as $guess) {
            $this->assertFalse(Hash::check($guess, $customers[0]->password));
        }
    }

    public function test_each_product_gets_one_to_three_reviews_and_consistent_totals(): void
    {
        $this->seedShop();

        Product::query()->lazyById()->each(function (Product $product) {
            $reviews = Review::where('product_id', $product->id)->get();

            $this->assertGreaterThanOrEqual(1, $reviews->count());
            $this->assertLessThanOrEqual(3, $reviews->count());
            $this->assertSame($reviews->count(), $product->reviews_count);
            $this->assertEqualsWithDelta($reviews->avg('rating'), (float) $product->ocena, 0.05);
            $this->assertGreaterThanOrEqual(1, $reviews->min('rating'));
            $this->assertLessThanOrEqual(5, $reviews->max('rating'));
        });
    }

    public function test_seeded_products_can_be_bought(): void
    {
        $this->seedShop();
        $variant = ProductVariant::where('stock', '>', 0)->with('product')->firstOrFail();

        $this->postJson('/api/cart/quote', ['items' => [[
            'product_id' => $variant->product_id,
            'quantity' => 1,
            'size' => $variant->size,
            'color' => $variant->color,
        ]], 'coupon' => 'WITAJ10'])
            ->assertOk()
            ->assertJsonPath('lines.0.available', true)
            ->assertJsonPath('coupon.code', 'WITAJ10');
    }

    public function test_seeding_an_existing_shop_with_if_empty_changes_nothing(): void
    {
        $this->seedShop();
        $products = Product::count();

        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();

        $this->assertSame($products, Product::count());
        $this->assertSame(6, Customer::count());
    }

    public function test_if_empty_fills_a_shop_that_only_has_products(): void
    {
        $products = collect(range(1, 4))->map(fn ($i) => $this->createProduct(['nazwa' => "Istniejący {$i}"]));

        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();

        $this->assertSame(4, Product::count());
        $this->assertSame(2, Coupon::count());
        $this->assertSame(6, Customer::count());
        $this->assertSame(4, Review::query()->distinct()->count('product_id'));
        $this->assertGreaterThan(0, $products[0]->fresh()->reviews_count);
    }

    public function test_if_empty_on_a_filled_shop_duplicates_nothing(): void
    {
        $this->createProduct();
        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();
        $reviews = Review::count();

        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();

        $this->assertSame(1, Product::count());
        $this->assertSame(2, Coupon::count());
        $this->assertSame(6, Customer::count());
        $this->assertSame($reviews, Review::count());
    }

    public function test_a_coupon_an_admin_deleted_does_not_come_back_on_restart(): void
    {
        $this->createProduct();
        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();
        Coupon::where('code', 'MINUS20')->delete();

        $this->artisan('shop:seed --local --if-empty')->assertSuccessful();

        $this->assertSame(['WITAJ10'], Coupon::pluck('code')->all());
    }

    public function test_a_plain_run_restores_a_single_missing_coupon(): void
    {
        $this->seedShop();
        Coupon::where('code', 'MINUS20')->delete();

        $this->seedShop();

        $this->assertSame(2, Coupon::count());
    }

    public function test_products_with_reviews_keep_them_when_others_are_filled(): void
    {
        $this->seedShop();
        $reviewed = Product::query()->firstOrFail();
        $before = Review::where('product_id', $reviewed->id)->pluck('id')->all();
        Product::query()->whereKeyNot($reviewed->id)->limit(3)->get()->each(fn ($product) => $product->reviews()->delete());

        $this->artisan('shop:seed --local')->assertSuccessful();

        $this->assertSame($before, Review::where('product_id', $reviewed->id)->pluck('id')->all());
    }

    public function test_seeding_twice_keeps_one_set_of_coupons_and_customers(): void
    {
        $this->seedShop();
        $this->seedShop();

        $this->assertSame(2, Coupon::count());
        $this->assertSame(6, Customer::count());
    }

    // shop:admin

    public function test_admin_command_creates_an_admin_who_can_sign_in(): void
    {
        $this->useAdminEnv('szef@example.com', 'bardzo-tajne-haslo');

        $this->artisan('shop:admin')->assertSuccessful();

        $admin = Customer::sole();
        $this->assertTrue($admin->is_admin);
        $this->postJson('/api/customer/login', ['email' => 'szef@example.com', 'password' => 'bardzo-tajne-haslo'])
            ->assertOk()->assertJsonPath('customer.is_admin', true);
    }

    public function test_admin_command_is_idempotent(): void
    {
        $this->useAdminEnv('szef@example.com', 'bardzo-tajne-haslo');
        $this->artisan('shop:admin')->assertSuccessful();
        $hash = Customer::sole()->password;
        $token = Customer::sole()->createToken('customer-token')->plainTextToken;

        $this->artisan('shop:admin')->assertSuccessful();

        $this->assertSame(1, Customer::count());
        $this->assertSame($hash, Customer::sole()->password);
        $this->assertSame(1, Customer::sole()->tokens()->count(), $token);
    }

    public function test_changing_the_password_updates_it_and_ends_old_sessions(): void
    {
        $this->useAdminEnv('szef@example.com', 'bardzo-tajne-haslo');
        $this->artisan('shop:admin')->assertSuccessful();
        Customer::sole()->createToken('customer-token');

        $this->useAdminEnv('szef@example.com', 'inne-tajne-haslo');
        $this->artisan('shop:admin')->assertSuccessful();

        $admin = Customer::sole();
        $this->assertTrue(Hash::check('inne-tajne-haslo', $admin->password));
        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_an_existing_customer_is_promoted_without_losing_their_details(): void
    {
        $customer = $this->createCustomer();
        $this->useAdminEnv($customer->email, 'bardzo-tajne-haslo');

        $this->artisan('shop:admin')->assertSuccessful();

        $fresh = $customer->fresh();
        $this->assertTrue($fresh->is_admin);
        $this->assertSame('Anna', $fresh->first_name);
    }

    public function test_admin_command_refuses_to_run_without_a_password(): void
    {
        foreach ([[null, null], ['szef@example.com', null], ['szef@example.com', ''], ['szef@example.com', 'krotkie'], ['nie-email', 'bardzo-tajne-haslo']] as [$email, $password]) {
            $this->useAdminEnv($email, $password);

            $this->artisan('shop:admin')->assertFailed();
        }

        $this->assertDatabaseCount('customers', 0);
    }

    public function test_admin_command_never_prints_the_password(): void
    {
        $this->useAdminEnv('szef@example.com', 'bardzo-tajne-haslo');

        Artisan::call('shop:admin');

        $this->assertStringNotContainsString('bardzo-tajne-haslo', Artisan::output());
    }
}
