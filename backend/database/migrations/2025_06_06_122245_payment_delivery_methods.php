<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_method', ['card', 'transfer', 'cash'])->default('card')->after('status');
            $table->enum('delivery_method', ['courier', 'pickup_point', 'store_pickup'])->default('courier')->after('payment_method');
            $table->decimal('delivery_price', 8, 2)->default(0)->after('delivery_method');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'delivery_method', 'delivery_price']);
        });
    }
};
