<?php
declare(strict_types=1);

// Development router. It copies the .htaccess rules for the PHP built-in server.
// Use: php -S 127.0.0.1:8080 tests/router.php   (run from the repository root)
// Keep the Content-Security-Policy the same as the copy in .htaccess.

if (PHP_SAPI !== 'cli-server') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// SMB_DEV_CONNECT=http://127.0.0.1:8081 lets the page download local fixtures. Development only.
$devConnect = preg_match('#^http://127\.0\.0\.1:\d+$#', (string) getenv('SMB_DEV_CONNECT')) ? ' ' . getenv('SMB_DEV_CONNECT') : '';
header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https:$devConnect; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Opener-Policy: same-origin');
header('Cross-Origin-Resource-Policy: same-origin');

$denied = preg_match('#(^|/)\.#', $path)
    || preg_match('#^/(src|var|tests)(/|$)#i', $path)
    || preg_match('#\.(md|sh|ini|json|lock|log|sql|bak|orig|swp)$#i', $path)
    || (preg_match('#^/api(/|$)#i', $path) && $path !== '/api/fetch.php');

if ($denied) {
    http_response_code(404);
    echo 'Not found';
    return true;
}

$versioned = false;
if (preg_match('#^/assets/v-[0-9a-f]+/(.+)$#', $path, $m)) {
    $path = '/assets/' . $m[1];
    $versioned = true;
}

if ($path === '/' || $path === '/index.php') {
    require $root . '/index.php';
    return true;
}
if ($path === '/api/fetch.php') {
    require $root . '/api/fetch.php';
    return true;
}

$file = realpath($root . $path);
if ($file === false || !is_file($file) || !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    echo 'Not found';
    return true;
}

$types = [
    'js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml',
    'txt' => 'text/plain', 'xml' => 'application/xml', 'html' => 'text/html', 'gz' => 'application/gzip',
];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: ' . ($versioned ? 'public, max-age=31536000, immutable' : 'no-cache'));
readfile($file);
return true;
