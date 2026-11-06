<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Builder;

class LikeSearch
{
    private const ESCAPE = '!';

    /**
     * Adds "any of these columns contains the term" to the query.
     *
     * Laravel's where(..., 'like', ...) writes no ESCAPE clause, and the default escape
     * character differs: a backslash on MySQL, none at all on sqlite. Naming one in the
     * SQL makes the same pattern work on both. $columns must come from code, never from
     * a request; the term only ever travels as a bound parameter.
     *
     * @param  list<string>  $columns
     */
    public static function apply(Builder $query, array $columns, string $term): void
    {
        $pattern = '%' . self::escape($term) . '%';

        $query->where(function ($inner) use ($columns, $pattern) {
            foreach ($columns as $column) {
                $wrapped = $inner->getGrammar()->wrap($column);

                $inner->orWhereRaw("{$wrapped} like ? escape '" . self::ESCAPE . "'", [$pattern]);
            }
        });
    }

    public static function escape(string $term): string
    {
        $escape = self::ESCAPE;

        return str_replace([$escape, '%', '_'], [$escape . $escape, $escape . '%', $escape . '_'], $term);
    }
}
