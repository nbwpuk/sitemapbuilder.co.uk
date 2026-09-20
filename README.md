# Sitemap Builder

The source of [sitemapbuilder.co.uk](https://sitemapbuilder.co.uk). Enter an XML sitemap URL and see the site as a
tree, treemap, sunburst, table, and statistics. The app follows sitemap index files to their sub-sitemaps.

All parsing and drawing occurs in the browser. The server has one task: a small proxy that downloads a sitemap
when the target site blocks direct browser access (CORS).

## How it works

1. The browser tries to download the sitemap directly.
2. If the browser blocks that (no CORS header, or an `http:` target), the browser asks `api/fetch.php`.
3. The browser reads the XML, follows index files (with limits), and builds the views.
4. The user can also paste XML or upload a `.xml`, `.xml.gz`, or `.txt` file. These paths use no server.

## Layout

| Path | Function |
|---|---|
| `index.php` | Page shell. Calculates the asset version. Reads no user input. |
| `.htaccess` | Security headers, deny rules, versioned-asset rewrite, cache rules. |
| `api/fetch.php` | The proxy endpoint. |
| `src/` | Proxy classes: `UrlGuard`, `SafeFetcher`, `RateLimiter`, `config.php`. No web access. |
| `assets/js/` | ES modules. No build step. |
| `assets/vendor/` | D3 7.9.0, local copy. `VENDOR.md` records the source and SHA-256. |
| `var/` | Rate-limit counters. No web access. Not in git. |
| `tests/` | Tests, fixtures, and the development router. No web access. |

## Deploy (cPanel)

- The repository root is the web root.
- Select PHP 8.3 or later in MultiPHP Manager. The `curl` extension must be on. `zlib` is recommended.
- Apache needs `mod_rewrite` and `mod_headers` (standard on cPanel).
- `var/` must be writable by PHP. As an alternative, create the directory `sitemapbuilder-var` one level
  **above** the web root. If it exists and is writable, the rate limiter uses it and nothing is written in the web root.
- Do not deploy `tests/`. `.gitattributes` marks it `export-ignore`, thus `git archive` leaves it out. If you deploy with a
  plain `git pull`, the deny rules protect it, but it is better to delete it on the server.
- The `zlib` extension is necessary for `.xml.gz` files through the proxy. Without it the proxy refuses gzip data.
- `.htaccess` sends all requests to `https://www.sitemapbuilder.co.uk` with a 301. `/.well-known/` is exempt, thus AutoSSL checks work.
  The HSTS header is sent only on HTTPS requests.
- If your domain is not `sitemapbuilder.co.uk`, change `own_hosts` in `src/config.php`.

After deployment, make sure that these URLs return 403 or 404:
`/.git/HEAD`, `/src/config.php`, `/var/`, `/tests/router.php`, `/README.md`.

## Cache busting

`index.php` makes a short hash from the path, modification time, and size of each file in `assets/`.
All asset URLs use the prefix `/assets/v-<hash>/`, and `.htaccess` rewrites that prefix to `/assets/`.
Module imports are relative, thus each script gets a new URL when any asset changes. No manual step is necessary.
Versioned URLs are cached for one year (`immutable`). The page itself is `no-cache`.

## Security model

Sitemap content is hostile input. The proxy is a possible tool for abuse. These are the controls:

| Risk | Control |
|---|---|
| SSRF to internal hosts or cloud metadata | `UrlGuard`: http/https only, ports 80/443 only, no credentials, strict hostname form, all resolved addresses must be public (IPv4 and IPv6 block lists plus `filter_var`). |
| DNS rebinding | cURL is pinned to the validated address (`CURLOPT_RESOLVE`). cURL gets a URL made from the validated parts, not the raw input. After the transfer, the connected address must be the validated address. Hosts with a trailing dot are refused. |
| Redirect to an internal host | Redirects are followed manually (maximum 3). Each hop is validated again. |
| Open proxy, content relay | The response must start as a `<urlset>` or `<sitemapindex>` document (gzip is inflated for the check). HTML, SVG, JSON, and a DOCTYPE are refused. |
| Proxy response runs in a browser | `application/octet-stream`, `nosniff`, `Content-Disposition: attachment`, CSP `sandbox`. |
| Use of the proxy from other sites | `Sec-Fetch-Site: same-origin` (or a same-host Origin/Referer) is necessary. No CORS headers are sent. |
| DoS relay, bandwidth abuse | For each client: 60 requests / 5 minutes and 200 MB / hour. Global: 600 requests / 5 minutes. 15 MB for each file. 20 s timeout. Honest User-Agent (`SitemapBuilder/1.0`), thus site owners can block it. |
| Very large crawls | Browser limits: 500 sitemap files, 250,000 URLs, index depth 3, 3 parallel downloads, cycle detection, cancel button. |
| Crawl of a third-party host through an index | The user must confirm one time before downloads from an unrelated host. |
| Gzip and XML entity bombs | Byte caps on the download and on the inflated data. A DOCTYPE is refused before the XML parser runs. |
| XSS through sitemap values | Untrusted text goes to the DOM only as text nodes. Links permit only http(s). Strict CSP: no inline script or style, no third-party origins. |
| CSV formula injection | Cells that start with `= + - @` get a leading apostrophe. |
| Drive-by crawl from a link | `?url=` only fills the field. A download starts only after a user action. |
| Exposure of private files | `.htaccess` denies dotfiles, `src/`, `var/`, `tests/`, `*.md`, and `*.ini`. Each private directory has a second deny file. `src/*.php` exit if called directly. |

The proxy target URL is in the query string, thus it is recorded in the Apache access log. The app has no other logs,
no cookies, and no analytics.

The Content-Security-Policy is in `.htaccess`. `tests/router.php` has a copy for development. Keep them the same.

## Development

```sh
# App with the .htaccess rules copied by a router (run from the repository root)
PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8080 tests/router.php

# Optional: local fixtures with CORS, which includes hostile input
php -S 127.0.0.1:8081 tests/fixtures/router.php
# then start the app with SMB_DEV_CONNECT=http://127.0.0.1:8081 to permit that origin in the CSP,
# and load http://127.0.0.1:8081/index.xml

# Tests
node --test tests/*.test.mjs
php tests/urlguard_test.php
```

The proxy refuses `127.0.0.1` by design, thus local fixtures work only through the direct (CORS) path.

## Credits

Built and hosted by [EncodeDotHost](https://encode.host). Charts use [D3](https://d3js.org) (ISC licence).
