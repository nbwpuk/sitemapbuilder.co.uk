<?php
declare(strict_types=1);

defined('SMB') || exit;

/**
 * Read a robots.txt file (RFC 9309): the rules for our agent and the Sitemap: lines.
 * This class has no network code. assets/js/robots.js has the same match logic.
 */
final class Robots
{
    /** The product token that a robots.txt group uses to name us. */
    public const AGENT = 'sitemapbuilder';

    private const MAX_RULES = 1000;
    private const MAX_SITEMAPS = 50;
    private const MAX_PATTERN = 1024;

    /**
     * The rules come from the groups that name our agent. If there are none, they come from the * groups.
     *
     * @return array{sitemaps: list<string>, rules: list<array{allow: bool, path: string}>}
     */
    public static function parse(string $text): array
    {
        if (strncmp($text, "\xef\xbb\xbf", 3) === 0) {
            $text = substr($text, 3);
        }
        $own = [];
        $any = [];
        $ownSeen = false;
        $sitemaps = [];
        $agents = [];
        $lastWasAgent = false;

        foreach (preg_split('/\r\n|\r|\n/', $text) as $line) {
            $hash = strpos($line, '#');
            if ($hash !== false) {
                $line = substr($line, 0, $hash);
            }
            $colon = strpos($line, ':');
            if ($colon === false) {
                continue;
            }
            $key = strtolower(trim(substr($line, 0, $colon)));
            $value = trim(substr($line, $colon + 1));

            if ($key === 'user-agent') {
                if (!$lastWasAgent) {
                    $agents = []; // A user-agent line after a rule starts a new group.
                }
                $token = $value === '*' ? '*' : strtolower((string) strtok($value, "/ \t"));
                $agents[] = $token;
                $ownSeen = $ownSeen || $token === self::AGENT;
                $lastWasAgent = true;
            } elseif ($key === 'allow' || $key === 'disallow') {
                $lastWasAgent = false;
                // An empty value permits all, thus it adds no rule.
                if ($value === '' || strlen($value) > self::MAX_PATTERN || ($value[0] !== '/' && $value[0] !== '*')) {
                    continue;
                }
                $rule = ['allow' => $key === 'allow', 'path' => $value];
                if (in_array(self::AGENT, $agents, true) && count($own) < self::MAX_RULES) {
                    $own[] = $rule;
                }
                if (in_array('*', $agents, true) && count($any) < self::MAX_RULES) {
                    $any[] = $rule;
                }
            } elseif ($key === 'sitemap') {
                if (count($sitemaps) < self::MAX_SITEMAPS && strlen($value) <= 2048
                    && preg_match('#^https?://[^\s\x00-\x1f\x7f]+$#i', $value) && !in_array($value, $sitemaps, true)) {
                    $sitemaps[] = $value;
                }
            }
        }
        return ['sitemaps' => $sitemaps, 'rules' => $ownSeen ? $own : $any];
    }

    /**
     * The longest rule that matches is the result. If an allow rule and a disallow rule
     * have the same length, the allow rule is the result. No match permits the path.
     *
     * @param list<array{allow: bool, path: string}> $rules
     * @param string $target Path and query, for example "/sitemap.xml?page=2".
     */
    public static function allows(array $rules, string $target): bool
    {
        $allowed = true;
        $best = -1;
        foreach ($rules as $rule) {
            $length = strlen($rule['path']);
            if ($length < $best || ($length === $best && !$rule['allow'])) {
                continue;
            }
            if (self::matches($rule['path'], $target)) {
                $best = $length;
                $allowed = $rule['allow'];
            }
        }
        return $allowed;
    }

    /** `*` is zero or more characters. `$` at the end is the end of the path. No regex, thus no backtracking. */
    public static function matches(string $pattern, string $target): bool
    {
        $anchored = str_ends_with($pattern, '$');
        if ($anchored) {
            $pattern = substr($pattern, 0, -1);
        }
        $parts = explode('*', $pattern);
        $last = count($parts) - 1;
        if (!str_starts_with($target, $parts[0])) {
            return false;
        }
        if ($last === 0) {
            return !$anchored || $target === $parts[0];
        }
        $pos = strlen($parts[0]);
        for ($i = 1; $i < $last; $i++) {
            if ($parts[$i] === '') {
                continue;
            }
            $found = strpos($target, $parts[$i], $pos);
            if ($found === false) {
                return false;
            }
            $pos = $found + strlen($parts[$i]);
        }
        if ($anchored) {
            return strlen($target) - strlen($parts[$last]) >= $pos && str_ends_with($target, $parts[$last]);
        }
        return $parts[$last] === '' || strpos($target, $parts[$last], $pos) !== false;
    }
}
