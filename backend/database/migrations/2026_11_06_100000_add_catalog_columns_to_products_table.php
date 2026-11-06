<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('kolor');
            $table->unsignedInteger('reviews_count')->default(0)->after('ocena');

            $table->index('kategoria');
            $table->index('is_active');
            $table->index('cena');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['kategoria']);
            $table->dropIndex(['is_active']);
            $table->dropIndex(['cena']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['is_active', 'reviews_count']);
        });
    }
};
