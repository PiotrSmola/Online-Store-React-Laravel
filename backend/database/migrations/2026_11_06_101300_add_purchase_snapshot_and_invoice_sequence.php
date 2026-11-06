<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('product_name')->nullable()->after('product_id');
        });

        // The current name is the best record left of what an old order bought.
        DB::table('order_items')->update([
            'product_name' => DB::raw('(select nazwa from products where products.id = order_items.product_id)'),
        ]);

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('invoice_sequence')->nullable()->after('invoice_number');
        });

        DB::table('orders')->whereNotNull('invoice_number')->select('id', 'invoice_number')->orderBy('id')
            ->chunkById(200, function ($orders) {
                foreach ($orders as $order) {
                    DB::table('orders')->where('id', $order->id)->update([
                        'invoice_sequence' => (int) substr(strrchr($order->invoice_number, '/'), 1),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('invoice_sequence');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('product_name');
        });
    }
};
