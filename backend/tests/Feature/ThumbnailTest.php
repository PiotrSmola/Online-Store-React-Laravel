<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\ProductImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\RequiresPhpExtension;
use Tests\Feature\Concerns\BuildsAdmins;
use Tests\Feature\Concerns\BuildsOrders;
use Tests\TestCase;

class ThumbnailTest extends TestCase
{
    use BuildsAdmins, BuildsOrders, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    private function imageBytes(string $type, int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 200, 30, 30, 60));

        ob_start();
        match ($type) {
            'jpg' => imagejpeg($image),
            'png' => imagepng($image),
            'webp' => imagewebp($image),
        };

        return ob_get_clean();
    }

    private function storeOriginal(string $name, string $bytes): void
    {
        Storage::disk('public')->put("products/{$name}", $bytes);
    }

    /** @return array{int, int, int} width, height, type */
    private function thumbnailInfo(string $name): array
    {
        return getimagesize(Storage::disk('public')->path("products/thumbs/{$name}"));
    }

    private function upload(Product $product, string $name, string $bytes): TestResponse
    {
        $this->actingAs($this->createAdmin(), 'sanctum');

        return $this->post(
            "/api/admin/products/{$product->id}/images",
            ['image' => UploadedFile::fake()->createWithContent($name, $bytes)],
            ['Accept' => 'application/json']
        );
    }

    // Without GD

    public function test_the_command_explains_itself_when_gd_is_missing(): void
    {
        $this->partialMock(ProductImageService::class)->shouldReceive('isAvailable')->andReturn(false);

        $this->artisan('shop:thumbnails')
            ->expectsOutputToContain('GD')
            ->assertFailed();
    }

    public function test_an_upload_works_without_gd_and_keeps_the_checked_original(): void
    {
        $this->partialMock(ProductImageService::class)->shouldReceive('isAvailable')->andReturn(false);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');

        $path = $this->upload($this->createProduct(), 'a.png', $png)->assertCreated()->json('image_path');

        $this->assertSame($png, Storage::disk('public')->get("products/{$path}"));
        Storage::disk('public')->assertMissing("products/thumbs/{$path}");
    }

    public function test_the_thumbs_directory_is_ignored_by_git(): void
    {
        $this->assertStringContainsString('/storage/app/public/products/thumbs/', file_get_contents(base_path('.gitignore')));
    }

    public function test_the_command_is_registered(): void
    {
        $this->assertArrayHasKey('shop:thumbnails', \Illuminate\Support\Facades\Artisan::all());
    }

    // With GD

    public static function formats(): array
    {
        return [
            'jpg' => ['jpg', IMAGETYPE_JPEG],
            'png' => ['png', IMAGETYPE_PNG],
            'webp' => ['webp', IMAGETYPE_WEBP],
        ];
    }

    #[DataProvider('formats')]
    #[RequiresPhpExtension('gd')]
    public function test_large_images_shrink_to_640_wide_under_the_same_name(string $extension, int $type): void
    {
        $this->storeOriginal("big.{$extension}", $this->imageBytes($extension, 1600, 1200));

        $this->artisan('shop:thumbnails')->assertSuccessful();

        [$width, $height, $thumbnailType] = $this->thumbnailInfo("big.{$extension}");
        $this->assertSame(640, $width);
        $this->assertSame(480, $height);
        $this->assertSame($type, $thumbnailType);
    }

    #[RequiresPhpExtension('gd')]
    public function test_small_images_are_not_enlarged(): void
    {
        $this->storeOriginal('small.jpg', $this->imageBytes('jpg', 300, 200));

        $this->artisan('shop:thumbnails')->assertSuccessful();

        $this->assertSame([300, 200], array_slice($this->thumbnailInfo('small.jpg'), 0, 2));
    }

    #[RequiresPhpExtension('gd')]
    public function test_a_very_narrow_image_keeps_at_least_one_pixel_of_height(): void
    {
        $this->storeOriginal('line.png', $this->imageBytes('png', 2000, 1));

        $this->artisan('shop:thumbnails')->assertSuccessful();

        $this->assertSame([640, 1], array_slice($this->thumbnailInfo('line.png'), 0, 2));
    }

    #[RequiresPhpExtension('gd')]
    public function test_png_transparency_survives(): void
    {
        $this->storeOriginal('alpha.png', $this->imageBytes('png', 800, 800));

        $this->artisan('shop:thumbnails')->assertSuccessful();

        $thumbnail = imagecreatefrompng(Storage::disk('public')->path('products/thumbs/alpha.png'));
        $alpha = (imagecolorat($thumbnail, 10, 10) >> 24) & 0x7F;

        $this->assertGreaterThan(0, $alpha);
    }

    #[RequiresPhpExtension('gd')]
    public function test_existing_thumbnails_are_skipped(): void
    {
        $this->storeOriginal('a.jpg', $this->imageBytes('jpg', 800, 800));
        Storage::disk('public')->put('products/thumbs/a.jpg', 'already here');

        $this->artisan('shop:thumbnails')
            ->expectsOutputToContain('pominięto istniejące: 1')
            ->assertSuccessful();

        $this->assertSame('already here', Storage::disk('public')->get('products/thumbs/a.jpg'));
    }

    #[RequiresPhpExtension('gd')]
    public function test_a_broken_file_is_reported_and_the_run_goes_on(): void
    {
        $this->storeOriginal('broken.jpg', 'not an image');
        $this->storeOriginal('good.jpg', $this->imageBytes('jpg', 800, 800));

        $this->artisan('shop:thumbnails')
            ->expectsOutputToContain('broken.jpg')
            ->expectsOutputToContain('Utworzono: 1')
            ->assertSuccessful();

        Storage::disk('public')->assertExists('products/thumbs/good.jpg');
        Storage::disk('public')->assertMissing('products/thumbs/broken.jpg');
    }

    #[RequiresPhpExtension('gd')]
    public function test_a_truncated_image_is_reported_not_fatal(): void
    {
        $this->storeOriginal('cut.jpg', substr($this->imageBytes('jpg', 800, 800), 0, 400));

        $this->artisan('shop:thumbnails')->assertSuccessful();
    }

    #[RequiresPhpExtension('gd')]
    public function test_an_image_too_large_for_memory_is_skipped_before_decoding(): void
    {
        // A header that claims far more pixels than the file holds.
        $this->storeOriginal('bomb.png', "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" . pack('NN', 30000, 30000) . "\x08\x06\x00\x00\x00" . str_repeat("\0", 64));

        $this->artisan('shop:thumbnails')->expectsOutputToContain('bomb.png')->assertSuccessful();
    }

    #[RequiresPhpExtension('gd')]
    public function test_memory_is_released_between_images(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->storeOriginal("m{$i}.jpg", $this->imageBytes('jpg', 1400, 1400));
        }

        $service = app(ProductImageService::class);
        $service->makeThumbnail('m0.jpg');
        $before = memory_get_usage();

        for ($i = 1; $i < 6; $i++) {
            $service->makeThumbnail("m{$i}.jpg");
        }

        $this->assertLessThan(1024 * 1024, memory_get_usage() - $before);
    }

    #[RequiresPhpExtension('gd')]
    public function test_upload_creates_a_thumbnail(): void
    {
        $path = $this->upload($this->createProduct(), 'photo.jpg', $this->imageBytes('jpg', 1000, 500))
            ->assertCreated()->json('image_path');

        Storage::disk('public')->assertExists("products/{$path}");
        $this->assertSame([640, 320], array_slice($this->thumbnailInfo($path), 0, 2));
    }

    #[DataProvider('formats')]
    #[RequiresPhpExtension('gd')]
    public function test_upload_reencodes_and_drops_what_was_hidden_in_the_file(string $extension, int $type): void
    {
        $payload = '<?php system($_GET["c"]); ?>';

        $path = $this->upload($this->createProduct(), "photo.{$extension}", $this->imageBytes($extension, 50, 50) . $payload)
            ->assertCreated()->json('image_path');

        $stored = Storage::disk('public')->get("products/{$path}");
        $this->assertStringNotContainsString($payload, $stored);
        $this->assertSame($type, getimagesizefromstring($stored)[2]);
    }

    #[RequiresPhpExtension('gd')]
    public function test_deleting_an_image_removes_its_thumbnail(): void
    {
        $product = $this->createProduct();
        $response = $this->upload($product, 'photo.jpg', $this->imageBytes('jpg', 1000, 500))->assertCreated();
        $path = $response->json('image_path');

        $this->deleteJson("/api/admin/products/{$product->id}/images/{$response->json('id')}")->assertOk();

        Storage::disk('public')->assertMissing("products/{$path}");
        Storage::disk('public')->assertMissing("products/thumbs/{$path}");
    }
}
