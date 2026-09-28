<?php
declare(strict_types=1);

defined('SMB') || exit;

require_once __DIR__ . '/env.php';

// Limits only. This file contains no secrets.
// Each value with an SMB_* key can be changed in .env (see .env.example).
return [
    'user_agent'        => 'SitemapBuilder/1.0 (+https://www.sitemapbuilder.co.uk/bot)',
    'max_bytes'         => env_int('SMB_MAX_BYTES', 15 * 1024 * 1024),
    'max_redirects'     => env_int('SMB_MAX_REDIRECTS', 3),
    'connect_timeout'   => env_int('SMB_CONNECT_TIMEOUT', 5),
    'total_timeout'     => env_int('SMB_TOTAL_TIMEOUT', 20),
    'allowed_ports'     => [80, 443],

    // The proxy never downloads from these hosts or their subdomains (stops request loops).
    'own_hosts'         => env_list('SMB_OWN_HOSTS', ['sitemapbuilder.co.uk']),

    // Fixed windows for each client address.
    'rate_window'       => env_int('SMB_RATE_WINDOW', 300),
    'rate_requests'     => env_int('SMB_RATE_REQUESTS', 60),
    'bytes_window'      => env_int('SMB_BYTES_WINDOW', 3600),
    'bytes_limit'       => env_int('SMB_BYTES_LIMIT', 200 * 1024 * 1024),
    // All clients together.
    'global_requests'   => env_int('SMB_GLOBAL_REQUESTS', 600),
];
