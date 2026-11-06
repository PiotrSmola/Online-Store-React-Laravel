<?php

namespace Tests\Feature\Concerns;

use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductVariant;

trait BuildsOrders
{
    protected string $customerPassword = 'correct-password';

    protected function createProduct(array $overrides = [], int $stock = 100): Product
    {
        $product = Product::create(array_merge([
            'nazwa' => 'Kurtka testowa',
            'kategoria' => 'Kurtki',
            'cena' => 100.50,
            'opis' => 'Opis produktu',
            'ocena' => 4.5,
            'rozmiar' => ['S', 'M'],
            'kolor' => ['Czarny', 'Pudrowy róż'],
        ], $overrides));

        foreach ($product->optionCombinations() as $combination) {
            $product->variants()->forceCreate($combination + ['stock' => $stock]);
        }

        return $product;
    }

    protected function variantOf(Product $product, string $size = 'M', string $color = 'Czarny'): ProductVariant
    {
        return $product->variants()->where(['size' => $size, 'color' => $color])->firstOrFail();
    }

    protected function createCustomer(array $overrides = []): Customer
    {
        return Customer::create(array_merge([
            'email' => 'victim@example.com',
            'password' => $this->customerPassword,
            'first_name' => 'Anna',
            'last_name' => 'Nowak',
            'phone' => '111222333',
            'address' => 'Stara 1',
            'city' => 'Kraków',
            'postal_code' => '30-001',
            'country' => 'Polska',
            'customer_type' => 'individual',
        ], $overrides));
    }

    protected function orderPayload(Product $product, array $overrides = []): array
    {
        return array_merge([
            'customer_type' => 'individual',
            'email' => 'new@example.com',
            'password' => 'new-password',
            'first_name' => 'Jan',
            'last_name' => 'Kowalski',
            'phone' => '500600700',
            'company_name' => null,
            'nip' => null,
            'address' => 'Nowa 2',
            'city' => 'Warszawa',
            'postal_code' => '00-001',
            'country' => 'Polska',
            'payment_method' => 'card',
            'delivery_method' => 'courier',
            'cart_items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'selected_size' => 'M',
                'selected_color' => 'Czarny',
            ]],
            'delivery_price' => 15.99,
            'total_with_delivery' => 116.49,
        ], $overrides);
    }
}
