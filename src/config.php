<?php
declare(strict_types=1);

defined('SMB') || exit;

// Limits only. This file contains no secrets.
return [
    'user_agent'        => 'SitemapBuilder/1.0 (+https://www.sitemapbuilder.co.uk/bot)',
    'max_bytes'         => 15 * 1024 * 1024,
    'max_redirects'     => 3,
    'connect_timeout'   => 5,
    'total_timeout'     => 20,
    'allowed_ports'     => [80, 443],

    // The proxy never downloads from these hosts or their subdomains (stops request loops).
    'own_hosts'         => ['sitemapbuilder.co.uk'],

    // Fixed windows for each client address.
    'rate_window'       => 300,
    'rate_requests'     => 60,
    'bytes_window'      => 3600,
    'bytes_limit'       => 200 * 1024 * 1024,
    // All clients together.
    'global_requests'   => 600,
];
