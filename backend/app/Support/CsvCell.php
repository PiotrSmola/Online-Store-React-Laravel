<?php

namespace App\Support;

class CsvCell
{
    /**
     * Spreadsheets run a cell that starts like a formula, and an address such as
     * =HYPERLINK(...)@example.com passes email validation. The leading apostrophe makes
     * the cell plain text. Full-width forms are included because Excel accepts them too.
     */
    public static function safe(string $value): string
    {
        return preg_match('/^[\s=+\-@＝＋－＠]/u', $value) === 1 ? "'" . $value : $value;
    }
}
