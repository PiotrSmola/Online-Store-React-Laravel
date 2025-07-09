<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('nazwa');
            $table->string('kategoria');
            $table->decimal('cena', 10, 2);
            $table->text('opis');
            $table->decimal('ocena', 2, 1)->default(0);
            $table->json('rozmiar')->nullable();
            $table->json('kolor')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
