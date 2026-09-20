<?php
// Fixture server with CORS, for local browser tests only.
// Use: php -S 127.0.0.1:8081 tests/fixtures/router.php
if (PHP_SAPI !== 'cli-server') { exit; }
$file = __DIR__ . '/' . basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (!is_file($file) || str_ends_with($file, '.php')) { http_response_code(404); exit('Not found'); }
header('Access-Control-Allow-Origin: *');
header('Content-Type: ' . (str_ends_with($file, '.gz') ? 'application/gzip' : 'application/xml'));
readfile($file);
