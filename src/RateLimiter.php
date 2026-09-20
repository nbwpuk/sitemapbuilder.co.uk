<?php
declare(strict_types=1);

defined('SMB') || exit;

/**
 * Fixed-window limits in small files, one file for each client. flock() makes updates atomic.
 * The file name is a hash of the address; the address itself is not stored.
 */
final class RateLimiter
{
    private string $dir;
    private string $clientFile;

    public function __construct(private readonly array $config, string $clientIp)
    {
        $this->dir = self::storageDir();
        $this->clientFile = $this->dir . '/' . hash('sha256', self::clientKey($clientIp)) . '.json';
    }

    /**
     * If the directory `sitemapbuilder-var` exists above the web root, use it (you create it; see README).
     * If not, use var/ in the web root, where .htaccess denies web access.
     */
    private static function storageDir(): string
    {
        $root = dirname(__DIR__);
        $outside = dirname($root) . '/sitemapbuilder-var';
        if (is_dir($outside) && is_writable($outside)) {
            return $outside;
        }
        $inside = $root . '/var/ratelimit';
        if ((is_dir($inside) || @mkdir($inside, 0700, true)) && is_writable($inside)) {
            return $inside;
        }
        throw new RuntimeException('No writable rate-limit directory');
    }

    /** IPv6 clients control a full /64, thus the /64 is the key. */
    private static function clientKey(string $ip): string
    {
        $packed = @inet_pton($ip);
        if ($packed !== false && strlen($packed) === 16) {
            return 'v6:' . bin2hex(substr($packed, 0, 8));
        }
        return 'v4:' . $ip;
    }

    /** Count one request. @return int 0 if permitted, else the number of seconds to wait. */
    public function hit(): int
    {
        $now = time();
        $wait = $this->update($this->dir . '/_global.json', function (array $s) use ($now): array {
            $s = self::roll($s, 'r', $now, $this->config['rate_window']);
            if ($s['r'] >= $this->config['global_requests']) {
                return [$s, $s['r_start'] + $this->config['rate_window'] - $now];
            }
            $s['r']++;
            return [$s, 0];
        });
        if ($wait > 0) {
            return $wait;
        }

        $wait = $this->update($this->clientFile, function (array $s) use ($now): array {
            $s = self::roll($s, 'r', $now, $this->config['rate_window']);
            $s = self::roll($s, 'b', $now, $this->config['bytes_window']);
            if ($s['b'] >= $this->config['bytes_limit']) {
                return [$s, $s['b_start'] + $this->config['bytes_window'] - $now];
            }
            if ($s['r'] >= $this->config['rate_requests']) {
                return [$s, $s['r_start'] + $this->config['rate_window'] - $now];
            }
            $s['r']++;
            return [$s, 0];
        });

        if (random_int(1, 100) === 1) {
            $this->collectGarbage($now);
        }
        return $wait;
    }

    public function addBytes(int $bytes): void
    {
        $now = time();
        $this->update($this->clientFile, function (array $s) use ($now, $bytes): array {
            $s = self::roll($s, 'b', $now, $this->config['bytes_window']);
            $s['b'] += $bytes;
            return [$s, 0];
        });
    }

    /** Start a new window if the old one is complete. */
    private static function roll(array $s, string $key, int $now, int $window): array
    {
        if (!isset($s[$key], $s[$key . '_start']) || $now - $s[$key . '_start'] >= $window) {
            $s[$key] = 0;
            $s[$key . '_start'] = $now;
        }
        return $s;
    }

    /** @param callable(array): array{array, int} $change */
    private function update(string $file, callable $change): int
    {
        $handle = fopen($file, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new RuntimeException('Rate-limit storage failure');
        }
        try {
            $state = json_decode((string) stream_get_contents($handle), true);
            [$state, $wait] = $change(is_array($state) ? $state : []);
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($state));
            return max(0, (int) $wait);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function collectGarbage(int $now): void
    {
        $maxAge = max($this->config['rate_window'], $this->config['bytes_window']) * 2;
        foreach (glob($this->dir . '/*.json') ?: [] as $file) {
            if ($now - (int) @filemtime($file) > $maxAge) {
                @unlink($file);
            }
        }
    }
}
