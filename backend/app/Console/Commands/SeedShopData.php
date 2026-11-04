<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class SeedShopData extends Command
{
    protected $signature = 'shop:seed
                            {--if-empty : Pomiń seedowanie, jeśli w bazie są już produkty}
                            {--local : Użyj tylko lokalnego pliku z danymi (bez zapytania do API)}';

    protected $description = 'Seed shop data from external API (falls back to database/data/products.json)';

    private const API_URL = 'https://run.mocky.io/v3/d175ce87-f8d2-4df3-84e8-c1342af1bf54';

    public function handle()
    {
        if ($this->option('if-empty') && Product::exists()) {
            $this->info('Produkty już istnieją w bazie - pomijam seedowanie.');
            return 0;
        }

        try {
            $products = $this->loadProducts();

            if ($products === null) {
                $this->error('Nie udało się pobrać danych produktów (ani z API, ani z pliku lokalnego).');
                return 1;
            }

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

            return 0;
        } catch (\Exception $e) {
            $this->error('Błąd podczas importowania danych: ' . $e->getMessage());
            return 1;
        }
    }

    private function loadProducts(): ?array
    {
        if (!$this->option('local')) {
            $this->info('Pobieranie danych produktów z API...');

            try {
                $response = Http::timeout(10)->get(self::API_URL);

                if ($response->successful() && is_array($response->json())) {
                    return $response->json();
                }

                $this->warn('API zwróciło błąd (HTTP ' . $response->status() . ').');
            } catch (\Exception $e) {
                $this->warn('Nie udało się połączyć z API: ' . $e->getMessage());
            }
        }

        $path = database_path('data/products.json');
        $this->info('Wczytywanie danych z pliku lokalnego: ' . $path);

        if (!is_file($path)) {
            return null;
        }

        $products = json_decode(file_get_contents($path), true);

        return is_array($products) ? $products : null;
    }
}
