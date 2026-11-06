<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\ProductImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\RequiresFunction;
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

    /** A landscape picture with a red top left corner on a blue background. */
    private function markedPng(int $width = 40, int $height = 20): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagefill($image, 0, 0, imagecolorallocate($image, 0, 0, 255));
        imagefilledrectangle($image, 0, 0, 9, 4, imagecolorallocate($image, 255, 0, 0));

        ob_start();
        imagepng($image);

        return ob_get_clean();
    }

    /** Puts an Orientation tag into a JPEG, the way a phone camera does. */
    private function withExifOrientation(string $jpeg, int $orientation): string
    {
        $tiff = "II*\0" . pack('V', 8) . pack('v', 1) . pack('vvVvv', 0x0112, 3, 1, $orientation, 0) . pack('V', 0);
        $app1 = "Exif\0\0" . $tiff;

        return substr($jpeg, 0, 2) . "\xFF\xE1" . pack('n', strlen($app1) + 2) . $app1 . substr($jpeg, 2);
    }

    public static function orientations(): array
    {
        return [
            'as stored' => [1, 40, 20, 'left', 'top'],
            'mirrored' => [2, 40, 20, 'right', 'top'],
            'upside down' => [3, 40, 20, 'right', 'bottom'],
            'flipped' => [4, 40, 20, 'left', 'bottom'],
            'transposed' => [5, 20, 40, 'left', 'top'],
            'phone held upright' => [6, 20, 40, 'right', 'top'],
            'transversed' => [7, 20, 40, 'right', 'bottom'],
            'phone held the other way' => [8, 20, 40, 'left', 'bottom'],
        ];
    }

    #[DataProvider('orientations')]
    #[RequiresPhpExtension('gd')]
    public function test_every_orientation_is_applied_before_encoding(int $orientation, int $width, int $height, string $side, string $edge): void
    {
        $this->partialMock(ProductImageService::class)->shouldReceive('orientationOf')->andReturn($orientation);

        $path = $this->upload($this->createProduct(), 'photo.png', $this->markedPng())->assertCreated()->json('image_path');

        $stored = imagecreatefromstring(Storage::disk('public')->get("products/{$path}"));
        $this->assertSame([$width, $height], [imagesx($stored), imagesy($stored)]);

        $x = $side === 'left' ? 1 : $width - 2;
        $y = $edge === 'top' ? 1 : $height - 2;
        $this->assertGreaterThan(200, (imagecolorat($stored, $x, $y) >> 16) & 0xFF, 'The red corner is not where it belongs.');
    }

    #[RequiresPhpExtension('gd')]
    public function test_the_thumbnail_of_a_turned_upload_is_turned_only_once(): void
    {
        $this->partialMock(ProductImageService::class)->shouldReceive('orientationOf')->andReturn(6, 1);

        $path = $this->upload($this->createProduct(), 'photo.png', $this->markedPng(1000, 500))->assertCreated()->json('image_path');

        $this->assertSame([500, 1000], array_slice(getimagesize(Storage::disk('public')->path("products/{$path}")), 0, 2));
        $this->assertSame([500, 1000], array_slice($this->thumbnailInfo($path), 0, 2));
    }

    #[RequiresPhpExtension('gd')]
    public function test_a_bad_orientation_value_is_ignored(): void
    {
        $service = app(ProductImageService::class);
        $this->storeOriginal('odd.png', $this->markedPng());

        $this->assertSame(1, $service->orientationOf(Storage::disk('public')->path('products/odd.png'), IMAGETYPE_PNG));
    }

    #[RequiresPhpExtension('gd')]
    #[RequiresFunction('exif_read_data')]
    public function test_a_real_phone_photo_comes_out_upright_without_its_exif(): void
    {
        $photo = $this->withExifOrientation($this->imageBytes('jpg', 60, 30), 6);

        $path = $this->upload($this->createProduct(), 'photo.jpg', $photo)->assertCreated()->json('image_path');

        $stored = Storage::disk('public')->get("products/{$path}");
        $this->assertSame([30, 60], array_slice(getimagesizefromstring($stored), 0, 2));
        $this->assertStringNotContainsString('Exif', $stored);
        $this->assertSame([30, 60], array_slice($this->thumbnailInfo($path), 0, 2));
    }

    #[RequiresPhpExtension('gd')]
    #[RequiresFunction('exif_read_data')]
    public function test_a_catalog_photo_gets_an_upright_thumbnail(): void
    {
        $this->storeOriginal('phone.jpg', $this->withExifOrientation($this->imageBytes('jpg', 1200, 600), 8));

        $this->artisan('shop:thumbnails')->assertSuccessful();

        $this->assertSame([600, 1200], array_slice($this->thumbnailInfo('phone.jpg'), 0, 2));
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
    public function test_a_photo_as_large_as_the_biggest_in_the_catalog_gets_a_thumbnail(): void
    {
        ini_set('memory_limit', '512M');

        // The size of database/data's zdj14.jpg, flat colour so the test file stays small.
        $this->storeOriginal('huge.jpg', $this->imageBytes('jpg', 5792, 8447));

        $this->artisan('shop:thumbnails')->expectsOutputToContain('Utworzono: 1')->assertSuccessful();

        $this->assertSame([640, 933], array_slice($this->thumbnailInfo('huge.jpg'), 0, 2));
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
