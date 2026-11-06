<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('size')->default('');
            $table->string('color')->default('');
            $table->unsignedInteger('quantity');
            $table->timestamps();

            $table->unique(['customer_id', 'product_id', 'size', 'color']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_items');
    }
};
