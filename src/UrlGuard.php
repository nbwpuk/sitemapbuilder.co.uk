<?php
declare(strict_types=1);

defined('SMB') || exit;

final class GuardException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, public readonly int $upstreamStatus = 0)
    {
        parent::__construct($errorCode);
    }
}

/**
 * Validation of target URLs and IP addresses (SSRF protection).
 * The proxy connects only to public addresses, on ports 80/443, with http or https.
 */
final class UrlGuard
{
    /** Networks that are not public. The filter_var() check below is a second layer. */
    private const BLOCKED = [
        '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
        '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15',
        '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
        '::/96', '::ffff:0:0/96', '64:ff9b::/96', '64:ff9b:1::/48', '100::/64',
        '2001::/23', '2001:db8::/32', '2002::/16', 'fc00::/7', 'fe80::/10', 'fec0::/10', 'ff00::/8',
    ];

    /** @param string[] $ownHosts @param int[] $allowedPorts @param string[] $ownAddresses */
    public function __construct(
        private readonly array $ownHosts,
        private readonly array $allowedPorts = [80, 443],
        private readonly array $ownAddresses = [],
    ) {
    }

    /**
     * @return array{scheme: string, host: string, port: int, target: string, isIp: bool, url: string}
     * @throws GuardException
     */
    public function parse(string $url): array
    {
        if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x20\x7f-\xff\\\\]/', $url)) {
            throw new GuardException('bad_url');
        }
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
            throw new GuardException('bad_url');
        }
        $scheme = strtolower($parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new GuardException('bad_url');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new GuardException('bad_url');
        }
        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
        if (!in_array($port, $this->allowedPorts, true)) {
            throw new GuardException('blocked_host');
        }

        // A trailing dot ("example.com.") is refused: libcurl and the DNS pin can treat it differently.
        $host = strtolower($parts['host']);
        if (str_ends_with($host, '.')) {
            throw new GuardException('bad_url');
        }
        $isIp = false;
        if (str_starts_with($host, '[') && str_ends_with($host, ']')) {
            $host = substr($host, 1, -1);
            if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) === false) {
                throw new GuardException('bad_url');
            }
            $isIp = true;
        } elseif (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            $isIp = true;
        } elseif (!$this->isHostname($host)) {
            // This also refuses decimal, octal, hex, and short IPv4 forms (2130706433, 0x7f.1, 127.1).
            throw new GuardException('bad_url');
        }

        if ($isIp) {
            if (!self::isPublicIp($host) || in_array($host, $this->ownAddresses, true)) {
                throw new GuardException('blocked_host');
            }
        } else {
            foreach ($this->ownHosts as $own) {
                if ($host === $own || str_ends_with($host, '.' . $own)) {
                    throw new GuardException('blocked_host');
                }
            }
        }

        $target = ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');

        // The fetcher uses this URL, not the raw input. It is made only from validated parts,
        // thus PHP and libcurl cannot read two different hosts from one string.
        $authority = (str_contains($host, ':') ? '[' . $host . ']' : $host) . ':' . $port;
        return [
            'scheme' => $scheme, 'host' => $host, 'port' => $port, 'target' => $target, 'isIp' => $isIp,
            'url' => $scheme . '://' . $authority . $target,
        ];
    }

    /** A DNS name with a minimum of two labels and an alphabetic (or punycode) top-level domain. */
    private function isHostname(string $host): bool
    {
        if (strlen($host) > 253) {
            return false;
        }
        return preg_match('/^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/', $host) === 1;
    }

    /**
     * Resolve a host. Refuse the host if ANY of its addresses is not public.
     *
     * @return string One validated address. The caller pins the connection to it.
     * @throws GuardException
     */
    public function resolve(string $host): string
    {
        $addresses = [];
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                $ip = $record['ip'] ?? $record['ipv6'] ?? null;
                if (is_string($ip)) {
                    $addresses[] = $ip;
                }
            }
        }
        if ($addresses === []) {
            $addresses = @gethostbynamel($host) ?: [];
        }
        if ($addresses === []) {
            throw new GuardException('dns');
        }
        return self::pick($addresses);
    }

    /**
     * Validate the addresses of one host and select the address for the connection.
     * Our own address is permitted here: other sites on a shared server have the same address.
     * parse() refuses our own host names, and the proxy refuses requests that are not same-origin.
     *
     * @param string[] $addresses
     * @throws GuardException
     */
    public static function pick(array $addresses): string
    {
        foreach ($addresses as $ip) {
            if (!self::isPublicIp($ip)) {
                throw new GuardException('blocked_host');
            }
        }
        // IPv4 first: many shared hosts have no IPv6 route.
        foreach ($addresses as $ip) {
            if (str_contains($ip, '.')) {
                return $ip;
            }
        }
        return $addresses[0];
    }

    public static function isPublicIp(string $ip): bool
    {
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return false;
        }
        foreach (self::BLOCKED as $cidr) {
            if (self::inCidr($packed, $cidr)) {
                return false;
            }
        }
        $flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
        if (defined('FILTER_FLAG_GLOBAL_RANGE')) {
            $flags |= FILTER_FLAG_GLOBAL_RANGE;
        }
        return filter_var($ip, FILTER_VALIDATE_IP, $flags) !== false;
    }

    private static function inCidr(string $packed, string $cidr): bool
    {
        [$network, $bits] = explode('/', $cidr);
        $net = inet_pton($network);
        if (strlen($net) !== strlen($packed)) {
            return false;
        }
        $bits = (int) $bits;
        $bytes = intdiv($bits, 8);
        if ($bytes > 0 && substr($packed, 0, $bytes) !== substr($net, 0, $bytes)) {
            return false;
        }
        $rest = $bits % 8;
        if ($rest === 0) {
            return true;
        }
        $mask = 0xff << (8 - $rest) & 0xff;
        return (ord($packed[$bytes]) & $mask) === (ord($net[$bytes]) & $mask);
    }
}
