<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductImageService
{
    public const DIRECTORY = 'products';

    /** Above this a decoded image no longer fits the workers' memory. */
    private const MAX_PIXELS = 40_000_000;

    private const JPEG_QUALITY = 85;

    private const WEBP_QUALITY = 82;

    /** The stored extension comes from the detected type, never from the client's file name. */
    private const EXTENSIONS = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];

    public function store(Product $product, UploadedFile $file): ProductImage
    {
        $path = $file->getRealPath();
        $type = $this->detectType($path);
        $name = Str::random(40) . '.' . self::EXTENSIONS[$type];

        Storage::disk('public')->put(self::DIRECTORY . '/' . $name, $this->reencode($path, $type) ?? file_get_contents($path));

        return ProductImage::create([
            'product_id' => $product->id,
            'image_path' => $name,
            'order' => (int) $product->images()->max('order') + 1,
        ]);
    }

    public function deleteFiles(string $imagePath): void
    {
        // image_path is only ever a bare file name; basename() keeps a bad row inside the directory.
        Storage::disk('public')->delete(self::DIRECTORY . '/' . basename($imagePath));
    }

    /**
     * Reads the type from the file's content. getimagesize parses the header only, so
     * this needs no GD and costs no memory however large the image claims to be.
     */
    private function detectType(string $path): int
    {
        $info = @getimagesize($path);

        if (!$info || !isset(self::EXTENSIONS[$info[2]]) || $info[0] < 1 || $info[1] < 1) {
            throw ValidationException::withMessages(['image' => ['Plik nie jest obrazem JPG, PNG ani WEBP.']]);
        }

        if ($info[0] * $info[1] > self::MAX_PIXELS) {
            throw ValidationException::withMessages(['image' => ['Obraz ma zbyt duże wymiary.']]);
        }

        return $info[2];
    }

    /**
     * Decoding and encoding again drops whatever else was hidden in the file, along with
     * metadata. Null without GD or support for the format: the checked original is stored.
     */
    private function reencode(string $path, int $type): ?string
    {
        if (!$this->gdSupports($type)) {
            return null;
        }

        $image = @imagecreatefromstring(file_get_contents($path));

        if (!$image) {
            throw ValidationException::withMessages(['image' => ['Nie udało się odczytać obrazu.']]);
        }

        imagesavealpha($image, true);

        ob_start();
        match ($type) {
            IMAGETYPE_JPEG => imagejpeg($image, null, self::JPEG_QUALITY),
            IMAGETYPE_PNG => imagepng($image),
            IMAGETYPE_WEBP => imagewebp($image, null, self::WEBP_QUALITY),
        };

        return ob_get_clean();
    }

    public function gdSupports(int $type): bool
    {
        if (!extension_loaded('gd')) {
            return false;
        }

        return (bool) (imagetypes() & match ($type) {
            IMAGETYPE_JPEG => IMG_JPEG,
            IMAGETYPE_PNG => IMG_PNG,
            IMAGETYPE_WEBP => IMG_WEBP,
        });
    }
}
