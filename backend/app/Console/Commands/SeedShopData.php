<?php

namespace App\Console\Commands;

use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Review;
use App\Services\ReviewService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SeedShopData extends Command
{
    protected $signature = 'shop:seed
                            {--if-empty : Pomiń seedowanie, jeśli w bazie są już produkty}
                            {--local : Użyj tylko lokalnego pliku z danymi (bez zapytania do API)}';

    protected $description = 'Seed shop data from external API (falls back to database/data/products.json)';

    private const API_URL = 'https://run.mocky.io/v3/d175ce87-f8d2-4df3-84e8-c1342af1bf54';

    /** Walked by product and variant position, so every run gives the same stock. */
    private const STOCK_PATTERN = [12, 8, 0, 15, 5, 2, 20, 9, 1, 6, 14, 0, 7, 11, 2, 18];

    private const DEMO_CUSTOMERS = [
        ['Anna', 'Kowalska'],
        ['Piotr', 'Nowak'],
        ['Maria', 'Wiśniewska'],
        ['Tomasz', 'Wójcik'],
        ['Katarzyna', 'Lewandowska'],
        ['Michał', 'Zieliński'],
    ];

    private const REVIEW_COMMENTS = [
        'Bardzo dobra jakość, polecam.',
        'Zgodne z opisem, szybka dostawa.',
        'Świetnie wygląda i dobrze leży.',
        'Solidne wykonanie, warte swojej ceny.',
        'Jestem zadowolona z zakupu.',
        'Dobry produkt, choć dostawa trwała dłużej.',
        'Kupiłem drugi raz i nadal polecam.',
        'Materiał przyjemny w dotyku.',
    ];

    public function handle(ReviewService $reviews)
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

            $this->seedCoupons();
            $customers = $this->seedCustomers();

            foreach ($products as $index => $productData) {
                $this->info('Przetwarzanie produktu: ' . $productData['nazwa']);

                $product = Product::create([
                    'nazwa' => $productData['nazwa'],
                    'kategoria' => $productData['kategoria'],
                    'cena' => $productData['cena'],
                    'sale_price' => $this->salePrice((float) $productData['cena'], $index),
                    'opis' => $productData['opis'],
                    'ocena' => $productData['ocena'],
                    'rozmiar' => $productData['rozmiar'],
                    'kolor' => $productData['kolor'],
                    // Every fifth product, by position, so every run marks the same ones.
                    'is_new' => $index % 5 === 1,
                ]);

                $imageName = 'zdj' . ($index + 1) . '.jpg';

                ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => $imageName,
                    'order' => 0,
                ]);

                $this->seedVariants($product, $index);
                $this->seedReviews($product, $index, $customers);
                $reviews->recalculate($product);

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

    /** Every fourth product is 20% off, chosen by position so every run marks the same ones. */
    private function salePrice(float $price, int $productIndex): ?float
    {
        return $productIndex % 4 === 2 ? round($price * 0.8, 2) : null;
    }

    private function seedVariants(Product $product, int $productIndex): void
    {
        foreach ($product->optionCombinations() as $variantIndex => $combination) {
            $position = ($productIndex * 3 + $variantIndex) % count(self::STOCK_PATTERN);

            $product->variants()->forceCreate($combination + ['stock' => self::STOCK_PATTERN[$position]]);
        }
    }

    /** One to three reviews, chosen by position so every run writes the same ones. */
    private function seedReviews(Product $product, int $productIndex, array $customers): void
    {
        $count = $productIndex % 3 + 1;

        for ($i = 0; $i < $count; $i++) {
            Review::create([
                'product_id' => $product->id,
                'customer_id' => $customers[($productIndex + $i) % count($customers)]->id,
                'rating' => max(1, min(5, (int) round((float) $product->ocena) - ($productIndex + $i) % 2)),
                'comment' => self::REVIEW_COMMENTS[($productIndex * 2 + $i) % count(self::REVIEW_COMMENTS)],
            ]);
        }
    }

    private function seedCoupons(): void
    {
        Coupon::firstOrCreate(['code' => 'WITAJ10'], ['type' => 'percent', 'value' => 10]);
        Coupon::firstOrCreate(['code' => 'MINUS20'], ['type' => 'fixed', 'value' => 20, 'min_order' => 150]);
    }

    /** @return list<Customer> */
    private function seedCustomers(): array
    {
        $customers = [];

        foreach (self::DEMO_CUSTOMERS as $index => [$firstName, $lastName]) {
            // Nobody signs in to these accounts, so the password is random and never shown.
            $customers[] = Customer::firstOrCreate(
                ['email' => 'demo' . ($index + 1) . '@example.com'],
                ['password' => Str::password(32), 'first_name' => $firstName, 'last_name' => $lastName]
            );
        }

        return $customers;
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
