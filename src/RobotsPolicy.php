<?php
declare(strict_types=1);

defined('SMB') || exit;

/**
 * The robots.txt data of each origin, with a file cache. One download serves all sitemap files of a host.
 * If robots.txt is absent or not available, all paths are permitted.
 */
final class RobotsPolicy
{
    private const TTL = 3600;

    /** @var array<string, array> */
    private array $memory = [];

    /** @param ?string $cacheDir Null: no file cache. */
    public function __construct(private readonly SafeFetcher $fetcher, private readonly ?string $cacheDir)
    {
    }

    /**
     * @param array $parts The result of UrlGuard::parse() for any URL of the origin.
     * @return array{found: bool, sitemaps: list<string>, rules: list<array{allow: bool, path: string}>}
     */
    public function forOrigin(array $parts): array
    {
        $origin = $parts['scheme'] . '://' . $parts['host'] . ':' . $parts['port'];
        if (isset($this->memory[$origin])) {
            return $this->memory[$origin];
        }
        $file = $this->cacheDir === null ? null : $this->cacheDir . '/' . hash('sha256', $origin) . '.json';
        $data = $file === null ? null : $this->read($file);
        if ($data === null) {
            $text = $this->fetcher->fetchRobots($parts);
            $data = ['found' => $text !== null] + Robots::parse($text ?? '');
            if ($file !== null) {
                $this->write($file, $data);
            }
        }
        return $this->memory[$origin] = $data;
    }

    /** @throws GuardException robots_denied */
    public function check(array $parts): void
    {
        if (!Robots::allows($this->forOrigin($parts)['rules'], $parts['target'])) {
            throw new GuardException('robots_denied');
        }
    }

    private function read(string $file): ?array
    {
        if (!is_file($file) || time() - (int) @filemtime($file) > self::TTL) {
            return null;
        }
        $data = json_decode((string) @file_get_contents($file), true);
        return is_array($data) && isset($data['found'], $data['sitemaps'], $data['rules']) ? $data : null;
    }

    private function write(string $file, array $data): void
    {
        $temp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($temp, json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE)) === false || !@rename($temp, $file)) {
            @unlink($temp);
        }
        if (random_int(1, 100) === 1) {
            foreach (glob($this->cacheDir . '/*') ?: [] as $old) {
                if (time() - (int) @filemtime($old) > self::TTL * 2) {
                    @unlink($old);
                }
            }
        }
    }
}
