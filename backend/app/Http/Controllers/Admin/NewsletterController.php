<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use App\Support\CsvCell;
use App\Support\LikeSearch;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class NewsletterController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $query = NewsletterSubscriber::query()
            ->select('id', 'email', 'confirmed_at', 'created_at')
            ->orderBy('id', 'desc');

        if (filled($validated['q'] ?? null)) {
            LikeSearch::apply($query, ['email'], $validated['q']);
        }

        return response()->json($query->paginate(self::PER_PAGE)->withQueryString());
    }

    /** Streamed row by row, so the export costs the same memory for ten addresses or a million. */
    public function export(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['email', 'confirmed_at'], escape: '');

            NewsletterSubscriber::query()
                ->select('id', 'email', 'confirmed_at')
                ->whereNotNull('confirmed_at')
                ->lazyById()
                ->each(function (NewsletterSubscriber $subscriber) use ($output) {
                    fputcsv($output, [
                        CsvCell::safe($subscriber->email),
                        $subscriber->confirmed_at->toDateTimeString(),
                    ], escape: '');
                });

            fclose($output);
        }, 'newsletter-' . now()->format('Y-m-d') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
