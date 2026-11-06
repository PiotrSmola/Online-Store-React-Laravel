<?php

namespace App\Console\Commands;

use App\Services\ProductImageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class GenerateThumbnails extends Command
{
    protected $signature = 'shop:thumbnails';

    protected $description = 'Create 640 px wide thumbnails for product images that do not have one yet';

    public function handle(ProductImageService $images): int
    {
        // Originals reach 9 MB as JPEG files, which is far more once decoded.
        ini_set('memory_limit', '512M');

        if (!$images->isAvailable()) {
            $this->error('Rozszerzenie PHP GD nie jest dostępne, nie można utworzyć miniatur.');

            return self::FAILURE;
        }

        $created = 0;
        $skipped = 0;
        $failed = 0;

        // files() is not recursive, so the thumbs directory itself is not walked.
        foreach (Storage::disk('public')->files(ProductImageService::DIRECTORY) as $path) {
            $name = basename($path);

            if ($images->hasThumbnail($name)) {
                $skipped++;
            } elseif ($images->makeThumbnail($name)) {
                $created++;
            } else {
                $failed++;
                $this->warn("Nie udało się utworzyć miniatury: {$name}");
            }
        }

        $this->info("Utworzono: {$created}, pominięto istniejące: {$skipped}, błędy: {$failed}.");

        return self::SUCCESS;
    }
}
