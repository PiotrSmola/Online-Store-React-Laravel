<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_status')->default('unpaid')->after('payment_method');
            $table->timestamp('paid_at')->nullable()->after('payment_status');
            $table->decimal('subtotal_amount', 10, 2)->default(0)->after('customer_id');
            $table->decimal('discount_amount', 10, 2)->default(0)->after('subtotal_amount');
            $table->string('coupon_code')->nullable()->after('discount_amount');
            $table->string('invoice_number')->nullable()->unique()->after('paid_at');

            $table->index('status');
        });

        // On MySQL the foreign key already created an index on customer_id, and a second
        // one could not be dropped again while the key depends on it. sqlite has none.
        if (!Schema::hasIndex('orders', ['customer_id'])) {
            Schema::table('orders', fn (Blueprint $table) => $table->index('customer_id'));
        }

        DB::table('orders')->update(['subtotal_amount' => DB::raw('total_amount - delivery_price')]);
    }

    public function down(): void
    {
        if (Schema::hasIndex('orders', 'orders_customer_id_index')) {
            Schema::table('orders', fn (Blueprint $table) => $table->dropIndex(['customer_id']));
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropUnique(['invoice_number']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'payment_status',
                'paid_at',
                'subtotal_amount',
                'discount_amount',
                'coupon_code',
                'invoice_number',
            ]);
        });
    }
};
