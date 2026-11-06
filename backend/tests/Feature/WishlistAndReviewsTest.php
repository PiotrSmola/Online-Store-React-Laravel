<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\WishlistItem;
use App\Services\OrderService;
use App\Services\ReviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\Feature\Concerns\CountsQueries;
use Tests\TestCase;

class WishlistAndReviewsTest extends TestCase
{
    use BuildsOrders, CountsQueries, RefreshDatabase;

    private function buy(Customer $customer, Product $product): Order
    {
        return app(OrderService::class)->place($customer, [
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'size' => 'M', 'color' => 'Czarny']],
            'payment_method' => 'transfer',
            'delivery_method' => 'courier',
            'billing_address' => [],
            'shipping_address' => [],
            'payment_details' => ['method' => 'transfer'],
        ]);
    }

    private function review(Customer $customer, Product $product, int $rating = 5, ?string $comment = 'Dobry'): TestResponse
    {
        return $this->actingAs($customer, 'sanctum')
            ->postJson("/api/products/{$product->id}/reviews", ['rating' => $rating, 'comment' => $comment]);
    }

    // Wishlist

    public function test_wishlist_adds_lists_and_removes_products(): void
    {
        $product = $this->createProduct([], 3);
        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->postJson("/api/wishlist/{$product->id}")->assertOk()->assertExactJson(['in_wishlist' => true]);

        $response = $this->getJson('/api/wishlist')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.stock_total', 12);
        $this->assertArrayNotHasKey('opis', $response->json('data.0'));

        $this->deleteJson("/api/wishlist/{$product->id}")->assertOk()->assertExactJson(['in_wishlist' => false]);
        $this->getJson('/api/wishlist')->assertJsonPath('total', 0);
    }

    public function test_adding_twice_keeps_one_row(): void
    {
        $product = $this->createProduct();
        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->postJson("/api/wishlist/{$product->id}")->assertOk();
        $this->postJson("/api/wishlist/{$product->id}")->assertOk();

        $this->assertDatabaseCount('wishlist_items', 1);
    }

    public function test_removing_something_not_on_the_list_is_harmless(): void
    {
        $product = $this->createProduct();
        $this->actingAs($this->createCustomer(), 'sanctum');

        $this->deleteJson("/api/wishlist/{$product->id}")->assertOk();
    }

    public function test_wishlists_are_private(): void
    {
        $owner = $this->createCustomer();
        $other = $this->createCustomer(['email' => 'other@example.com']);
        $product = $this->createProduct();
        WishlistItem::create(['customer_id' => $owner->id, 'product_id' => $product->id]);

        $this->actingAs($other, 'sanctum');

        $this->getJson('/api/wishlist')->assertJsonPath('total', 0);
        $this->deleteJson("/api/wishlist/{$product->id}")->assertOk();
        $this->assertDatabaseHas('wishlist_items', ['customer_id' => $owner->id, 'product_id' => $product->id]);
    }

    public function test_inactive_product_cannot_be_added_and_leaves_the_list(): void
    {
        $hidden = $this->createProduct(['is_active' => false]);
        $customer = $this->createCustomer();
        WishlistItem::create(['customer_id' => $customer->id, 'product_id' => $hidden->id]);
        $this->actingAs($customer, 'sanctum');

        $this->postJson("/api/wishlist/{$hidden->id}")->assertNotFound();
        $this->getJson('/api/wishlist')->assertJsonPath('total', 0);
    }

    public function test_wishlist_needs_a_login(): void
    {
        $product = $this->createProduct();

        $this->getJson('/api/wishlist')->assertUnauthorized();
        $this->postJson("/api/wishlist/{$product->id}")->assertUnauthorized();
        $this->deleteJson("/api/wishlist/{$product->id}")->assertUnauthorized();
    }

    public function test_wishlist_query_count_does_not_grow(): void
    {
        $customer = $this->createCustomer();
        $this->actingAs($customer, 'sanctum');
        WishlistItem::create(['customer_id' => $customer->id, 'product_id' => $this->createProduct()->id]);
        $one = $this->countQueries(fn () => $this->getJson('/api/wishlist')->assertOk());

        for ($i = 0; $i < 5; $i++) {
            WishlistItem::create(['customer_id' => $customer->id, 'product_id' => $this->createProduct()->id]);
        }

        $this->assertSame($one, $this->countQueries(fn () => $this->getJson('/api/wishlist')->assertOk()));
    }

    // Reviews

    public function test_buyer_can_review_and_the_product_totals_follow(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct(['ocena' => 2.0]);
        $this->buy($customer, $product);

        $this->review($customer, $product, 4, 'Bardzo dobra')->assertOk()
            ->assertJsonPath('author', 'Anna N.')
            ->assertJsonPath('rating', 4)
            ->assertJsonPath('comment', 'Bardzo dobra')
            ->assertJsonMissingPath('customer_id')
            ->assertJsonMissingPath('customer');

        $fresh = $product->fresh();
        $this->assertSame('4.0', $fresh->ocena);
        $this->assertSame(1, $fresh->reviews_count);
    }

    public function test_a_second_review_replaces_the_first(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);

        $this->review($customer, $product, 5)->assertOk();
        $this->review($customer, $product, 1, 'Jednak nie')->assertOk();

        $review = Review::sole();
        $this->assertSame(1, $review->rating);
        $this->assertSame('Jednak nie', $review->comment);
        $this->assertSame(1, $product->fresh()->reviews_count);
        $this->assertSame('1.0', $product->fresh()->ocena);
    }

    public function test_average_covers_all_reviewers_rounded_to_one_decimal(): void
    {
        $product = $this->createProduct();

        foreach ([5, 4, 4] as $i => $rating) {
            $customer = $this->createCustomer(['email' => "kupujacy{$i}@example.com"]);
            $this->buy($customer, $product);
            $this->review($customer, $product, $rating)->assertOk();
            $this->app['auth']->forgetGuards();
        }

        $this->assertSame('4.3', $product->fresh()->ocena);
        $this->assertSame(3, $product->fresh()->reviews_count);
    }

    public function test_someone_who_did_not_buy_cannot_review(): void
    {
        $this->review($this->createCustomer(), $this->createProduct())->assertForbidden();

        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_a_cancelled_order_does_not_count_as_buying(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $order = $this->buy($customer, $product);
        app(OrderService::class)->changeStatus($order, 'cancelled');

        $this->review($customer, $product)->assertForbidden();
    }

    public function test_an_order_of_another_customer_does_not_count(): void
    {
        $product = $this->createProduct();
        $this->buy($this->createCustomer(), $product);

        $this->review($this->createCustomer(['email' => 'other@example.com']), $product)->assertForbidden();
    }

    public function test_a_review_cannot_be_written_in_someone_elses_name(): void
    {
        $customer = $this->createCustomer();
        $victim = $this->createCustomer(['email' => 'other@example.com']);
        $product = $this->createProduct();
        $this->buy($customer, $product);

        $this->actingAs($customer, 'sanctum')->postJson("/api/products/{$product->id}/reviews", [
            'rating' => 5,
            'customer_id' => $victim->id,
            'product_id' => 999,
        ])->assertOk();

        $this->assertSame($customer->id, (int) Review::sole()->customer_id);
        $this->assertSame($product->id, (int) Review::sole()->product_id);
    }

    public function test_a_review_of_mine_leaves_another_buyers_review_alone(): void
    {
        $first = $this->createCustomer();
        $second = $this->createCustomer(['email' => 'other@example.com']);
        $product = $this->createProduct();
        $this->buy($first, $product);
        $this->buy($second, $product);

        $this->review($first, $product, 5, 'Pierwsza')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->review($second, $product, 1, 'Druga')->assertOk();

        $this->assertSame('Pierwsza', Review::where('customer_id', $first->id)->value('comment'));
        $this->assertDatabaseCount('reviews', 2);
    }

    public function test_rating_must_be_from_one_to_five(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);

        foreach ([0, 6, 'pięć', 4.5, null] as $rating) {
            $this->actingAs($customer, 'sanctum')
                ->postJson("/api/products/{$product->id}/reviews", ['rating' => $rating])
                ->assertStatus(422)->assertJsonValidationErrors(['rating']);
        }
    }

    public function test_comment_is_stored_as_plain_text_and_returned_as_is(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);

        $this->review($customer, $product, 5, '<script>alert(1)</script>')
            ->assertJsonPath('comment', '<script>alert(1)</script>');
    }

    public function test_inactive_product_cannot_be_reviewed(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);
        $product->update(['is_active' => false]);

        $this->review($customer, $product)->assertNotFound();
    }

    public function test_review_needs_a_login(): void
    {
        $this->postJson("/api/products/{$this->createProduct()->id}/reviews", ['rating' => 5])->assertUnauthorized();
    }

    public function test_review_posting_is_rate_limited(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);

        for ($i = 0; $i < 10; $i++) {
            $this->review($customer, $product)->assertOk();
        }

        $this->review($customer, $product)->assertStatus(429)
            ->assertExactJson(['message' => 'Zbyt wiele prób. Spróbuj ponownie za chwilę.']);
    }

    public function test_product_detail_shows_latest_twenty_reviews_with_short_names(): void
    {
        $product = $this->createProduct();
        for ($i = 0; $i < 22; $i++) {
            $customer = $this->createCustomer(['email' => "c{$i}@example.com", 'first_name' => 'Jan', 'last_name' => 'Żak']);
            Review::create(['product_id' => $product->id, 'customer_id' => $customer->id, 'rating' => 5, 'comment' => "Opinia {$i}"]);
        }

        $response = $this->getJson("/api/products/{$product->id}")->assertOk()->assertJsonCount(20, 'reviews');

        $response->assertJsonPath('reviews.0.comment', 'Opinia 21')->assertJsonPath('reviews.0.author', 'Jan Ż.');
        $this->assertSame(['id', 'author', 'rating', 'comment', 'created_at'], array_keys($response->json('reviews.0')));
    }

    public function test_product_detail_query_count_does_not_grow_with_reviews(): void
    {
        $product = $this->createProduct();
        $customer = $this->createCustomer();
        Review::create(['product_id' => $product->id, 'customer_id' => $customer->id, 'rating' => 5]);
        $one = $this->countQueries(fn () => $this->getJson("/api/products/{$product->id}")->assertOk());

        for ($i = 0; $i < 5; $i++) {
            $other = $this->createCustomer(['email' => "c{$i}@example.com"]);
            Review::create(['product_id' => $product->id, 'customer_id' => $other->id, 'rating' => 5]);
        }

        $this->assertSame($one, $this->countQueries(fn () => $this->getJson("/api/products/{$product->id}")->assertOk()));
    }

    public function test_can_review_follows_the_optional_login(): void
    {
        $buyer = $this->createCustomer();
        $stranger = $this->createCustomer(['email' => 'other@example.com']);
        $product = $this->createProduct();
        $this->buy($buyer, $product);
        $buyerToken = $buyer->createToken('customer-token')->plainTextToken;
        $strangerToken = $stranger->createToken('customer-token')->plainTextToken;

        $this->getJson("/api/products/{$product->id}")->assertOk()->assertJsonPath('can_review', false);

        $this->withToken($buyerToken)->getJson("/api/products/{$product->id}")->assertJsonPath('can_review', true);

        $this->app['auth']->forgetGuards();
        $this->withToken($strangerToken)->getJson("/api/products/{$product->id}")->assertJsonPath('can_review', false);
    }

    public function test_a_bad_token_on_the_public_product_page_is_only_a_guest(): void
    {
        $this->withToken('1|not-a-token')->getJson("/api/products/{$this->createProduct()->id}")
            ->assertOk()->assertJsonPath('can_review', false);
    }

    public function test_deleting_a_review_recalculates_and_handles_the_last_one(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct(['ocena' => 3.0]);
        $service = app(ReviewService::class);
        $review = $service->save($customer, $product, 5, null);

        $service->delete($review);

        $this->assertSame(0, $product->fresh()->reviews_count);
        $this->assertSame('0.0', $product->fresh()->ocena);
    }

    public function test_review_counters_are_not_mass_assignable(): void
    {
        $this->assertFalse((new Product(['reviews_count' => 99]))->isDirty('reviews_count'));
    }

    public function test_a_new_review_does_not_empty_the_catalog_cache(): void
    {
        $customer = $this->createCustomer();
        $product = $this->createProduct();
        $this->buy($customer, $product);
        $version = Cache::get('catalog:version');

        $this->review($customer, $product)->assertOk();

        $this->assertSame($version, Cache::get('catalog:version'));
    }
}
