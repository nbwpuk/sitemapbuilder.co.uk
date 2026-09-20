<?php
declare(strict_types=1);

defined('SMB') || exit;

/**
 * Download one sitemap file. Each hop is validated by UrlGuard, and the connection
 * is pinned to the validated address (DNS rebinding protection).
 */
final class SafeFetcher
{
    private const SNIFF_BYTES = 8192;

    public function __construct(private readonly UrlGuard $guard, private readonly array $config)
    {
    }

    /** @throws GuardException */
    public function fetch(string $url): string
    {
        for ($hop = 0; $hop <= $this->config['max_redirects']; $hop++) {
            $parts = $this->guard->parse($url);
            $ip = $parts['isIp'] ? null : $this->guard->resolve($parts['host']);

            [$status, $location, $body] = $this->request($parts, $ip);

            if (in_array($status, [301, 302, 303, 307, 308], true)) {
                if ($location === '') {
                    throw new GuardException('upstream_error');
                }
                $url = self::resolveLocation($parts, $location);
                continue;
            }
            if ($status !== 200) {
                throw new GuardException('upstream_status', $status);
            }
            if (!self::looksLikeSitemap($body)) {
                throw new GuardException('not_sitemap');
            }
            return $body;
        }
        throw new GuardException('too_many_redirects');
    }

    /** @return array{int, string, string} status, Location header, body */
    private function request(array $parts, ?string $ip): array
    {
        $body = '';
        $location = '';
        $status = 0;
        $failure = '';
        $sniffed = false;
        $discarded = 0;
        $max = $this->config['max_bytes'];

        $ch = curl_init();
        $options = [
            CURLOPT_URL => $parts['url'],
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => $this->config['connect_timeout'],
            CURLOPT_TIMEOUT => $this->config['total_timeout'],
            CURLOPT_LOW_SPEED_LIMIT => 1024,
            CURLOPT_LOW_SPEED_TIME => 10,
            CURLOPT_USERAGENT => $this->config['user_agent'],
            CURLOPT_HTTPHEADER => ['Accept: application/xml, text/xml, application/gzip, */*;q=0.1'],
            CURLOPT_PROXY => '',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_NOSIGNAL => true,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$status, &$location): int {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                    $status = (int) $m[1];
                    $location = '';
                } elseif (stripos($line, 'location:') === 0) {
                    $location = trim(substr($line, 9));
                }
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => static function ($ch, string $chunk) use (&$body, &$status, &$failure, &$sniffed, &$discarded, $max): int {
                if ($status >= 300) {
                    // Redirect and error bodies are not used. Stop if one is large.
                    $discarded += strlen($chunk);
                    return $discarded <= 65536 ? strlen($chunk) : -1;
                }
                $body .= $chunk;
                if (strlen($body) > $max) {
                    $failure = 'too_large';
                    return -1;
                }
                // Check the content early, thus we do not download a large file that is not a sitemap.
                if (!$sniffed && strlen($body) >= self::SNIFF_BYTES) {
                    $sniffed = true;
                    if (!self::looksLikeSitemap($body)) {
                        $failure = 'not_sitemap';
                        return -1;
                    }
                }
                return strlen($chunk);
            },
        ];
        if (defined('CURLOPT_PROTOCOLS_STR')) {
            $options[CURLOPT_PROTOCOLS_STR] = 'http,https';
        } else {
            $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
        }
        if ($ip !== null) {
            $address = str_contains($ip, ':') ? '[' . $ip . ']' : $ip;
            $options[CURLOPT_RESOLVE] = [$parts['host'] . ':' . $parts['port'] . ':' . $address];
        }
        curl_setopt_array($ch, $options);
        $ok = curl_exec($ch);

        // Second layer: the address that curl connected to must be the address that we validated.
        $connected = (string) curl_getinfo($ch, CURLINFO_PRIMARY_IP);
        if ($connected !== '') {
            $expected = $ip ?? $parts['host'];
            if (@inet_pton($connected) !== @inet_pton($expected) || !UrlGuard::isPublicIp($connected)) {
                throw new GuardException('blocked_host');
            }
        }

        if ($failure !== '') {
            throw new GuardException($failure);
        }
        if ($ok === false && $status < 300) {
            throw new GuardException('upstream_error');
        }
        return [$status, $location, $body];
    }

    /** Make an absolute URL from a Location header. UrlGuard validates the result on the next hop. */
    private static function resolveLocation(array $base, string $location): string
    {
        if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $location)) {
            return $location;
        }
        $host = str_contains($base['host'], ':') ? '[' . $base['host'] . ']' : $base['host'];
        $origin = $base['scheme'] . '://' . $host . ':' . $base['port'];
        if (str_starts_with($location, '//')) {
            return $base['scheme'] . ':' . $location;
        }
        if (str_starts_with($location, '/')) {
            return $origin . $location;
        }
        $path = (string) strtok($base['target'], '?');
        $dir = substr($path, 0, (int) strrpos($path, '/') + 1);
        return $origin . $dir . $location;
    }

    /**
     * True if the data starts as a sitemap: a <urlset> or <sitemapindex> root in the first bytes.
     * For gzip data we inflate only the start. The proxy thus does not relay HTML or other files.
     */
    public static function looksLikeSitemap(string $data): bool
    {
        if (strncmp($data, "\x1f\x8b", 2) === 0) {
            if (!function_exists('inflate_init')) {
                return false; // Without zlib we cannot check the content, thus we refuse it.
            }
            $context = @inflate_init(ZLIB_ENCODING_GZIP);
            $data = $context === false ? false : @inflate_add($context, substr($data, 0, 2048), ZLIB_SYNC_FLUSH);
            if (!is_string($data)) {
                return false;
            }
        }
        $head = substr($data, 0, self::SNIFF_BYTES);
        if (strncmp($head, "\xef\xbb\xbf", 3) === 0) {
            $head = substr($head, 3);
        }
        $head = ltrim($head);
        if ($head === '' || $head[0] !== '<' || stripos($head, '<!DOCTYPE') !== false) {
            return false;
        }
        return preg_match('/<(?:[A-Za-z][\w.-]*:)?(?:urlset|sitemapindex)[\s>]/', $head) === 1;
    }
}
