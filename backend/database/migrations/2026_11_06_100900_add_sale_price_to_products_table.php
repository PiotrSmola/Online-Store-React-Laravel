<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('sale_price', 10, 2)->nullable()->after('cena');
        });

        // Computed by the database, so no write path can leave it out of step with the two
        // prices. Virtual because sqlite cannot add a stored column to an existing table;
        // both databases can index a virtual one, and filters and sorts then need no raw SQL.
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('effective_price', 10, 2)->virtualAs('COALESCE(sale_price, cena)');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index('effective_price');
            $table->index('sale_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['effective_price']);
            $table->dropIndex(['sale_price']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('effective_price');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('sale_price');
        });
    }
};
