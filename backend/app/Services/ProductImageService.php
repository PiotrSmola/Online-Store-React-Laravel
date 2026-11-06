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

    public const THUMBNAIL_DIRECTORY = self::DIRECTORY . '/thumbs';

    private const THUMBNAIL_WIDTH = 640;

    /**
     * Refused outright, however much memory is free. The catalog's own photos reach 49 MP,
     * and at this ceiling a decoded image still fits the 512 MB the containers run with.
     */
    private const MAX_PIXELS = 64_000_000;

    /** Rough cost of one decoded pixel in GD: four bytes plus line overhead. */
    private const BYTES_PER_PIXEL = 5;

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
        $this->makeThumbnail($name);

        return ProductImage::create([
            'product_id' => $product->id,
            'image_path' => $name,
            'order' => (int) $product->images()->max('order') + 1,
        ]);
    }

    public function deleteFiles(string $imagePath): void
    {
        // image_path is only ever a bare file name; basename() keeps a bad row inside the directory.
        $name = basename($imagePath);

        Storage::disk('public')->delete([self::DIRECTORY . '/' . $name, self::THUMBNAIL_DIRECTORY . '/' . $name]);
    }

    public function isAvailable(): bool
    {
        return extension_loaded('gd');
    }

    public function hasThumbnail(string $name): bool
    {
        return Storage::disk('public')->exists(self::THUMBNAIL_DIRECTORY . '/' . $name);
    }

    /**
     * Writes a copy of a stored image, at most 640 wide, under the same name in thumbs/.
     * Images narrower than that are copied at their own size, never enlarged.
     *
     * @return bool false when the file cannot be turned into a thumbnail
     */
    public function makeThumbnail(string $name): bool
    {
        $disk = Storage::disk('public');
        $source = $disk->path(self::DIRECTORY . '/' . $name);

        // Header only: the size is known before any memory is spent on the pixels.
        $info = @getimagesize($source);

        if (!$info || !isset(self::EXTENSIONS[$info[2]]) || !$this->gdSupports($info[2])) {
            return false;
        }

        [$width, $height, $type] = $info;
        $orientation = $this->orientationOf($source, $type);

        if ($width * $height > self::MAX_PIXELS || !$this->fitsInMemory($width, $height, $orientation)) {
            return false;
        }

        $image = @imagecreatefromstring(file_get_contents($source));

        if (!$image) {
            return false;
        }

        // Catalog photos reach this point with their EXIF, uploads were turned before storing.
        $image = $this->upright($image, $orientation);
        $width = imagesx($image);
        $height = imagesy($image);

        $targetWidth = min($width, self::THUMBNAIL_WIDTH);
        $targetHeight = max(1, (int) round($height * $targetWidth / $width));
        $thumbnail = imagecreatetruecolor($targetWidth, $targetHeight);

        imagealphablending($thumbnail, false);
        imagesavealpha($thumbnail, true);
        imagecopyresampled($thumbnail, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        // A GdImage is freed with its last reference; imagedestroy() is a no-op on PHP 8.
        // The full size bitmap goes first, it is by far the largest allocation here.
        unset($image);

        $disk->makeDirectory(self::THUMBNAIL_DIRECTORY);

        // Through a temporary file, so a run killed halfway leaves nothing that looks finished.
        $target = $disk->path(self::THUMBNAIL_DIRECTORY . '/' . $name);
        $this->encode($thumbnail, $type, $target . '.tmp');
        unset($thumbnail);

        return rename($target . '.tmp', $target);
    }

    /**
     * The EXIF orientation of a JPEG, 1 (as stored) when it has none. Without the exif
     * extension a sideways phone photo simply stays sideways; nothing else breaks.
     */
    public function orientationOf(string $path, int $type): int
    {
        if ($type !== IMAGETYPE_JPEG || !function_exists('exif_read_data')) {
            return 1;
        }

        $orientation = (int) ((@exif_read_data($path) ?: [])['Orientation'] ?? 1);

        return $orientation >= 1 && $orientation <= 8 ? $orientation : 1;
    }

    /** Applies an EXIF orientation to the pixels, since re-encoding drops the tag that described it. */
    private function upright(\GdImage $image, int $orientation): \GdImage
    {
        $angle = match ($orientation) {
            3 => 180,
            5, 6 => -90,
            7, 8 => 90,
            default => 0,
        };

        // Rebinding frees the original as soon as its copy exists.
        if ($angle !== 0) {
            $image = imagerotate($image, $angle, 0);
        }

        $flip = match ($orientation) {
            2, 5, 7 => IMG_FLIP_HORIZONTAL,
            4 => IMG_FLIP_VERTICAL,
            default => null,
        };

        if ($flip !== null) {
            imageflip($image, $flip);
        }

        return $image;
    }

    private function fitsInMemory(int $width, int $height, int $orientation = 1): bool
    {
        $limit = ini_parse_quantity(ini_get('memory_limit'));

        // Turning needs the old and the new bitmap at once; flipping works in place.
        $bitmaps = in_array($orientation, [1, 2, 4], true) ? 1 : 2;

        return $limit <= 0 || $width * $height * self::BYTES_PER_PIXEL * $bitmaps < $limit - memory_get_usage();
    }

    private function encode(\GdImage $image, int $type, ?string $target = null): void
    {
        match ($type) {
            IMAGETYPE_JPEG => imagejpeg($image, $target, self::JPEG_QUALITY),
            IMAGETYPE_PNG => imagepng($image, $target),
            IMAGETYPE_WEBP => imagewebp($image, $target, self::WEBP_QUALITY),
        };
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

        [$width, $height] = getimagesize($path);
        $orientation = $this->orientationOf($path, $type);

        if (!$this->fitsInMemory($width, $height, $orientation)) {
            throw ValidationException::withMessages(['image' => ['Obraz ma zbyt duże wymiary.']]);
        }

        $image = @imagecreatefromstring(file_get_contents($path));

        if (!$image) {
            throw ValidationException::withMessages(['image' => ['Nie udało się odczytać obrazu.']]);
        }

        $image = $this->upright($image, $orientation);
        imagesavealpha($image, true);

        ob_start();
        $this->encode($image, $type);

        return ob_get_clean();
    }

    private function gdSupports(int $type): bool
    {
        if (!$this->isAvailable()) {
            return false;
        }

        return (bool) (imagetypes() & match ($type) {
            IMAGETYPE_JPEG => IMG_JPEG,
            IMAGETYPE_PNG => IMG_PNG,
            IMAGETYPE_WEBP => IMG_WEBP,
        });
    }
}
