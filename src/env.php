<?php
declare(strict_types=1);

defined('SMB') || exit;

// Settings from the environment. The file .env in the repository root holds them (not in git).
// .env.example lists all keys. A real environment variable with the same name wins over the file.

/** The value of one setting, or `$default` if it is not set. A blank value counts as not set. */
function env(string $key, ?string $default = null): ?string
{
    static $file = null;
    if ($file === null) {
        $file = env_parse((string) @file_get_contents(dirname(__DIR__) . '/.env'));
    }
    $value = getenv($key);
    if (!is_string($value) || $value === '') {
        $value = $file[$key] ?? '';
    }
    return $value === '' ? $default : $value;
}

/** An integer setting. Values that are not a positive whole number give `$default`. */
function env_int(string $key, int $default): int
{
    $value = env($key);
    return $value !== null && ctype_digit($value) ? (int) $value : $default;
}

/** A yes/no setting: 1, true, yes, on = true. 0, false, no, off = false. */
function env_bool(string $key, bool $default): bool
{
    $value = strtolower((string) env($key, ''));
    return match ($value) {
        '1', 'true', 'yes', 'on' => true,
        '0', 'false', 'no', 'off' => false,
        default => $default,
    };
}

/** A comma-separated setting as a list of trimmed, non-empty strings. */
function env_list(string $key, array $default): array
{
    $value = env($key);
    if ($value === null) {
        return $default;
    }
    $items = array_filter(array_map('trim', explode(',', $value)), fn(string $s): bool => $s !== '');
    return array_values($items);
}

/**
 * Parse the text of a .env file into an array.
 * One `KEY=value` for each line. `#` starts a comment. Quotes around a value are removed.
 * A `export ` prefix is permitted, thus the file also works with `source`.
 */
function env_parse(string $text): array
{
    $values = [];
    foreach (preg_split('/\R/', $text) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (str_starts_with($line, 'export ')) {
            $line = ltrim(substr($line, 7));
        }
        if (preg_match('/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/', $line, $m) !== 1) {
            continue;
        }
        $value = $m[2];
        if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && $value[-1] === $value[0]) {
            $value = substr($value, 1, -1);
        } else {
            $value = rtrim((string) preg_replace('/\s+#.*$/', '', $value));
        }
        $values[$m[1]] = $value;
    }
    return $values;
}
