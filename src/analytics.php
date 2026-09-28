<?php
declare(strict_types=1);

defined('SMB') || exit;

require_once __DIR__ . '/env.php';

// Optional analytics. Both trackers are off until .env sets their keys.
// The settings go to the browser as data attributes on <html>. assets/js/analytics.js reads them.

/**
 * The validated analytics settings.
 * `ga` is a GA4 measurement ID or null. `matomo` is ['url', 'origin', 'site'] or null.
 * `cookies` is true only if SMB_ANALYTICS_COOKIES permits tracking cookies.
 */
function analytics_config(): array
{
    static $config = null;
    return $config ??= analytics_validate(
        env('SMB_GA_ID'),
        env('SMB_MATOMO_URL'),
        env('SMB_MATOMO_SITE_ID'),
        env_bool('SMB_ANALYTICS_COOKIES', false),
    );
}

/** Validate raw settings. A value that is not valid turns that tracker off. */
function analytics_validate(?string $gaId, ?string $matomoUrl, ?string $matomoSite, bool $cookies): array
{
    $ga = strtoupper(trim((string) $gaId));
    if (preg_match('/^G-[A-Z0-9]{4,20}$/', $ga) !== 1) {
        $ga = null;
    }

    $matomo = null;
    $url = trim((string) $matomoUrl);
    $site = trim((string) $matomoSite);
    if ($url !== '' && ctype_digit($site)) {
        $url = rtrim($url, '/') . '/';
        $parts = parse_url($url);
        $host = (string) ($parts['host'] ?? '');
        $path = (string) ($parts['path'] ?? '/');
        $ok = is_array($parts)
            && ($parts['scheme'] ?? '') === 'https'
            && preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i', $host) === 1
            && preg_match('#^/[A-Za-z0-9/._-]*$#', $path) === 1
            && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['query']) && !isset($parts['fragment']);
        if ($ok) {
            $origin = 'https://' . strtolower($host) . (isset($parts['port']) ? ':' . $parts['port'] : '');
            $matomo = ['url' => $origin . $path, 'origin' => $origin, 'site' => $site];
        }
    }

    return ['ga' => $ga, 'matomo' => $matomo, 'cookies' => $cookies];
}

/** True if at least one tracker is on. */
function analytics_on(): bool
{
    $a = analytics_config();
    return $a['ga'] !== null || $a['matomo'] !== null;
}

/** The names of the trackers that are on, for the footer. */
function analytics_names(): array
{
    $a = analytics_config();
    return array_values(array_filter([
        $a['ga'] !== null ? 'Google Analytics' : null,
        $a['matomo'] !== null ? 'Matomo' : null,
    ]));
}

/** Data attributes for the <html> element. Empty if no tracker is on. */
function analytics_attributes(): string
{
    $a = analytics_config();
    if (!analytics_on()) {
        return '';
    }
    $attrs = ' data-analytics-cookies="' . ($a['cookies'] ? '1' : '0') . '"';
    if ($a['ga'] !== null) {
        $attrs .= ' data-ga-id="' . e($a['ga']) . '"';
    }
    if ($a['matomo'] !== null) {
        $attrs .= ' data-matomo-url="' . e($a['matomo']['url']) . '" data-matomo-site="' . e($a['matomo']['site']) . '"';
    }
    return $attrs;
}

/** Extra Content-Security-Policy sources for the trackers, by directive. */
function analytics_csp_sources(): array
{
    $a = analytics_config();
    $script = [];
    $img = [];
    if ($a['ga'] !== null) {
        $script[] = 'https://www.googletagmanager.com';
        $img[] = 'https://*.google-analytics.com';
        $img[] = 'https://*.googletagmanager.com';
    }
    if ($a['matomo'] !== null) {
        $script[] = $a['matomo']['origin'];
        $img[] = $a['matomo']['origin'];
    }
    return ['script-src' => $script, 'img-src' => $img];
}
