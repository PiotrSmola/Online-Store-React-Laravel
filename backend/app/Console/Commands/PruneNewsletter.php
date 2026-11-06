<?php

namespace App\Console\Commands;

use App\Services\NewsletterService;
use Illuminate\Console\Command;

class PruneNewsletter extends Command
{
    protected $signature = 'newsletter:prune';

    protected $description = 'Delete newsletter addresses that were never confirmed';

    public function handle(NewsletterService $newsletter): int
    {
        $this->info('Usunięto niepotwierdzone adresy: ' . $newsletter->pruneUnconfirmed() . '.');

        return self::SUCCESS;
    }
}
