<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('customer_type');
            $table->string('address')->nullable()->change();
            $table->string('city')->nullable()->change();
            $table->string('postal_code')->nullable()->change();
        });
    }

    public function down(): void
    {
        foreach (['address', 'city', 'postal_code'] as $column) {
            DB::table('customers')->whereNull($column)->update([$column => '']);
        }

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('is_admin');
            $table->string('address')->nullable(false)->change();
            $table->string('city')->nullable(false)->change();
            $table->string('postal_code')->nullable(false)->change();
        });
    }
};
