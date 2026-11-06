<?php

namespace Tests\Feature\Concerns;

use Illuminate\Support\Facades\DB;

trait CountsQueries
{
    /** Number of SQL statements the callback runs. */
    protected function countQueries(callable $callback): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $callback();

        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }
}
