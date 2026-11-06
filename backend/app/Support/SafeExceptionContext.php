<?php

namespace App\Support;

class SafeExceptionContext
{
    /**
     * Exception messages can embed SQL bindings (emails, password hashes) and trace
     * strings embed call arguments, so only the type and code locations are logged.
     */
    public static function of(\Throwable $e): array
    {
        $appFrames = [];

        foreach ($e->getTrace() as $frame) {
            if (isset($frame['file']) && !str_contains($frame['file'], DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR)) {
                $appFrames[] = $frame['file'] . ':' . ($frame['line'] ?? '?');
            }
        }

        return [
            'exception_class' => $e::class,
            'code' => $e->getCode(),
            'location' => $e->getFile() . ':' . $e->getLine(),
            'app_frames' => array_slice($appFrames, 0, 10),
        ];
    }
}
