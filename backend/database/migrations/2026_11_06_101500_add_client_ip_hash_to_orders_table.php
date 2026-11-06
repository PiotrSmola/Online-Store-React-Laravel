<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // A keyed hash: enough to count orders per address without storing the address.
            $table->string('client_ip_hash', 64)->nullable()->index()->after('customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['client_ip_hash']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('client_ip_hash');
        });
    }
};
