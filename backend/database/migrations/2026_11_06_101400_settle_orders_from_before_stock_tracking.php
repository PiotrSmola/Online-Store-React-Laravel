<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY_NOTE = 'Zamówienie złożone przed aktualizacją sklepu';

    public function up(): void
    {
        // False by default on purpose: returning stock that was never taken would invent units.
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('stock_deducted')->default(false)->after('status');
        });

        // Only OrderService writes status events, so these orders did take their stock.
        DB::table('orders')
            ->whereIn('id', DB::table('order_status_events')->select('order_id'))
            ->update(['stock_deducted' => true]);

        DB::table('orders')
            ->where('stock_deducted', false)
            ->select('id', 'status', 'payment_method', 'payment_details', 'order_date')
            ->orderBy('id')
            ->chunkById(200, function ($orders) {
                foreach ($orders as $order) {
                    $this->settle($order);
                }
            });
    }

    public function down(): void
    {
        DB::table('order_status_events')->where('note', self::LEGACY_NOTE)->delete();

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('stock_deducted');
        });
    }

    private function settle(object $order): void
    {
        $details = json_decode($order->payment_details, true) ?: [];

        // The old checkout took the card with the order, so these were paid when placed.
        if ($order->payment_method === 'card' && !empty($details['card_last_four'])) {
            DB::table('orders')->where('id', $order->id)->update([
                'payment_status' => $order->status === 'cancelled' ? 'refunded' : 'paid',
                'paid_at' => $order->order_date,
            ]);
        }

        DB::table('order_status_events')->insert([
            'order_id' => $order->id,
            'status' => $order->status,
            'note' => self::LEGACY_NOTE,
            'created_at' => $order->order_date,
            'updated_at' => $order->order_date,
        ]);
    }
};
