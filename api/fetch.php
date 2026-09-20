<?php
declare(strict_types=1);

// Sitemap download proxy. The browser calls it only when the target blocks a direct download (CORS).
// GET /api/fetch.php?url=<absolute http(s) URL>
// Success: the raw file bytes. Failure: {"error": "<code>"} with a 4xx/5xx status.
// The proxy obeys the robots.txt file of the target.
//
// GET /api/fetch.php?mode=robots&url=<absolute http(s) URL>
// Success: JSON with the Sitemap: lines and the rules for our agent from the robots.txt file of that origin.
// The raw robots.txt text is never sent, thus the proxy relays sitemap data only.

const SMB = 1;

ini_set('display_errors', '0');
set_time_limit(90);

require __DIR__ . '/../src/UrlGuard.php';
require __DIR__ . '/../src/SafeFetcher.php';
require __DIR__ . '/../src/Robots.php';
require __DIR__ . '/../src/RobotsPolicy.php';
require __DIR__ . '/../src/RateLimiter.php';
$config = require __DIR__ . '/../src/config.php';

// The response is data only. A browser must never render or run it.
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="sitemap.bin"');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: sandbox; default-src 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function fail(int $httpStatus, string $code, array $extra = []): never
{
    http_response_code($httpStatus);
    header('Content-Type: application/json');
    header_remove('Content-Disposition');
    echo json_encode(['error' => $code] + $extra);
    exit;
}

/**
 * True if the page that made the request is on our own origin.
 * This stops use of the proxy from other websites. The rate limiter is the real control.
 */
function is_same_origin(): bool
{
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? null;
    if ($site !== null) {
        return $site === 'same-origin';
    }
    $source = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
    $sourceHost = parse_url($source, PHP_URL_HOST);
    $sourcePort = parse_url($source, PHP_URL_PORT);
    $own = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $candidate = strtolower((string) $sourceHost) . ($sourcePort ? ':' . $sourcePort : '');
    return is_string($sourceHost) && $own !== '' && $candidate === $own;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    fail(405, 'forbidden');
}
if (!is_same_origin()) {
    fail(403, 'forbidden');
}

$url = $_GET['url'] ?? null;
if (!is_string($url)) {
    fail(400, 'bad_url');
}

try {
    $limiter = new RateLimiter($config, (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $wait = $limiter->hit();
} catch (Throwable) {
    fail(503, 'upstream_error'); // Fail closed: no limiter, no proxy.
}
if ($wait > 0) {
    header('Retry-After: ' . $wait);
    fail(429, 'rate_limited');
}

$ownAddresses = array_filter([$_SERVER['SERVER_ADDR'] ?? null]);
$guard = new UrlGuard($config['own_hosts'], $config['allowed_ports'], array_values($ownAddresses));

$robotsDir = null;
try {
    $robotsDir = RateLimiter::storageDir() . '/robots';
    if (!is_dir($robotsDir) && !@mkdir($robotsDir, 0700)) {
        $robotsDir = null;
    }
} catch (Throwable) {
    // No cache directory: the policy downloads robots.txt for each request.
}
$fetcher = new SafeFetcher($guard, $config);
$policy = new RobotsPolicy($fetcher, $robotsDir);

try {
    if (($_GET['mode'] ?? '') === 'robots') {
        $body = json_encode($policy->forOrigin($guard->parse($url)), JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        header('Content-Type: application/json');
        header_remove('Content-Disposition');
    } else {
        $body = $fetcher->fetch($url, $policy->check(...));
    }
} catch (GuardException $e) {
    $status = match ($e->errorCode) {
        'bad_url' => 400,
        'blocked_host', 'robots_denied' => 403,
        'too_large' => 413,
        'not_sitemap' => 415,
        default => 502,
    };
    fail($status, $e->errorCode, $e->upstreamStatus ? ['status' => $e->upstreamStatus] : []);
} catch (Throwable) {
    fail(500, 'upstream_error');
}

try {
    $limiter->addBytes(strlen($body));
} catch (Throwable) {
    // The download is complete; a counter failure does not change the response.
}

header('Content-Length: ' . strlen($body));
echo $body;
