<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class SeedShopData extends Command
{
    protected $signature = 'shop:seed';
    protected $description = 'Seed shop data from external API';

    public function handle()
    {
        $this->info('Pobieranie danych produktów...');

        try {
            $response = Http::get('https://run.mocky.io/v3/d175ce87-f8d2-4df3-84e8-c1342af1bf54');

            if (!$response->successful()) {
                $this->error('Nie udało się pobrać danych z API');
                return 1;
            }

            $products = $response->json();
            $this->info('Znaleziono ' . count($products) . ' produktów');

            if (!Storage::disk('public')->exists('products')) {
                Storage::disk('public')->makeDirectory('products');
            }

            foreach ($products as $index => $productData) {
                $this->info('Przetwarzanie produktu: ' . $productData['nazwa']);

                $product = Product::create([
                    'nazwa' => $productData['nazwa'],
                    'kategoria' => $productData['kategoria'],
                    'cena' => $productData['cena'],
                    'opis' => $productData['opis'],
                    'ocena' => $productData['ocena'],
                    'rozmiar' => $productData['rozmiar'],
                    'kolor' => $productData['kolor'],
                ]);

                $imageName = 'zdj' . ($index + 1) . '.jpg';

                ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => $imageName,
                    'order' => 0,
                ]);

                $this->line('✓ Utworzono produkt: ' . $product->nazwa);
            }

            $this->info('');
            $this->info('Pomyślnie zaimportowano ' . count($products) . ' produktów!');
            $this->info('');
            $this->warn('UWAGA: Pamiętaj o dodaniu rzeczywistych zdjęć produktów do katalogu storage/app/public/products/');
            $this->warn('Pliki powinny nazywać się: zdj1.jpg, zdj2.jpg, zdj3.jpg, itd.');

            return 0;
        } catch (\Exception $e) {
            $this->error('Błąd podczas importowania danych: ' . $e->getMessage());
            return 1;
        }
    }
}
