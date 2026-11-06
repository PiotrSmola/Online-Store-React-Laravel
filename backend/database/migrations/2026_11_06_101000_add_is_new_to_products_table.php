<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_new')->default(false)->after('is_active');
            $table->index('is_new');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['is_new']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_new');
        });
    }
};
