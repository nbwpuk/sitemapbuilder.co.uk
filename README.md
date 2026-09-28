# Sitemap Builder

The source of [sitemapbuilder.co.uk](https://sitemapbuilder.co.uk). Enter an XML sitemap URL and see the site as a
tree, treemap, sunburst, table, and statistics. The app follows sitemap index files to their sub-sitemaps.

All parsing and drawing occurs in the browser. The server has one task: a small proxy that downloads a sitemap
when the target site blocks direct browser access (CORS).

## How it works

1. The user types a sitemap address. A missing `https://` is added. For a bare domain, the tool reads the `Sitemap:` lines in `robots.txt`. If there are none, it uses `/sitemap.xml`.
2. Before each download, the browser asks the proxy for the `robots.txt` rules of the host (one time for each host). If a rule denies the file, the user must confirm a direct download, and the proxy refuses the file.
3. The browser tries to download the sitemap directly.
4. If the browser blocks that (no CORS header, or an `http:` target), the browser asks `api/fetch.php`.
5. The browser reads the XML, follows index files (with limits), and builds the views.
6. The user can also paste XML or upload a `.xml`, `.xml.gz`, or `.txt` file. These paths use no server.

## Layout

| Path | Function |
|---|---|
| `.env.example` | All settings, with their defaults. Copy it to `.env` (not in git) and change what you need. See [Settings](#settings). |
| `index.php` | Main page. Reads no user input. |
| `changelog.php` | Changelog page at `/changelog`. It renders `CHANGELOG.md`. |
| `bot.php` | Information for site owners at `/bot`. The proxy User-Agent links to it. |
| `CHANGELOG.md` | The release notes. Add a new `## version - date` section at the top for each release. The top section gives the version number in the footer. |
| `.htaccess` | Security headers, deny rules, versioned-asset rewrite, cache rules. |
| `api/fetch.php` | The proxy endpoint. `mode=robots` gives the `robots.txt` data of an origin as JSON. |
| `src/` | Shared page layout (`layout.php`, which also calculates the asset version and the CSP), the settings reader (`env.php`), the analytics settings (`analytics.php`), the changelog renderer, and the proxy classes: `UrlGuard`, `SafeFetcher`, `Robots`, `RobotsPolicy`, `RateLimiter`, `config.php`. No web access. |
| `assets/js/` | ES modules. No build step. `analytics.js` loads the trackers only when the page carries their settings. |
| `assets/vendor/` | D3 7.9.0, local copy. `VENDOR.md` records the source and SHA-256. |
| `var/` | Rate-limit counters and the `robots.txt` cache. No web access. Not in git. |
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
- Settings: copy `.env.example` to `.env` on the server and set the values that you need. If your domain is not
  `sitemapbuilder.co.uk`, set `SMB_OWN_HOSTS`. Without a `.env` file, the defaults in `src/config.php` apply and analytics is off.

After deployment, make sure that these URLs return 403 or 404:
`/.git/HEAD`, `/.env`, `/src/config.php`, `/var/`, `/tests/router.php`, `/README.md`.

Also make sure that the home page sends exactly one `Content-Security-Policy` header, which starts with `default-src 'none'`.
The pages send their own policy with the analytics origins. `.htaccess` adds the base policy only when a response has
none (`Header always setifempty`), thus static files get it and PHP responses keep theirs. A parent `.htaccess` (for
example `~/.htaccess` on cPanel) must not set `Content-Security-Policy` with `Header set`, or the browser sees two
policies and applies the strictest one.

## Settings

`src/env.php` reads `.env` in the repository root. One `KEY=value` for each line, `#` starts a comment, quotes around a
value are optional. A real environment variable with the same name wins over the file. `.env.example` lists all keys.

| Key | Function |
|---|---|
| `SMB_GA_ID` | Google Analytics 4 measurement ID (`G-…`). Turns Google Analytics on. |
| `SMB_MATOMO_URL`, `SMB_MATOMO_SITE_ID` | The https address of a Matomo installation and the site ID. Both turn Matomo on. |
| `SMB_ANALYTICS_COOKIES` | `1` permits tracking cookies. Default `0`: Matomo uses `disableCookies`, Google Analytics uses consent mode with `analytics_storage` denied. |
| `SMB_OWN_HOSTS` | Hosts that the proxy never downloads from. Comma separated. |
| `SMB_MAX_BYTES`, `SMB_MAX_REDIRECTS`, `SMB_CONNECT_TIMEOUT`, `SMB_TOTAL_TIMEOUT` | Proxy download limits. |
| `SMB_RATE_WINDOW`, `SMB_RATE_REQUESTS`, `SMB_BYTES_WINDOW`, `SMB_BYTES_LIMIT`, `SMB_GLOBAL_REQUESTS` | Proxy rate limits. |

A value that is not valid (for example a GA ID with the wrong form, or a Matomo address without `https`) turns that
tracker off. Nothing is written to the page.

## Analytics

Both trackers are off until `.env` turns them on. When a tracker is on, `src/layout.php` puts its settings in data
attributes on `<html>`, adds its origin to the CSP, loads `assets/js/analytics.js`, and changes the footer text.
`analytics.js` loads `gtag.js` or `matomo.js` and records a page view. The app records these events with `track()`:

| Event | When | Params |
|---|---|---|
| `sitemap_load` | The user starts a run. | `method` (`url`, `paste`, `file`), `label` (the sitemap address, or the method), `host` |
| `sitemap_done` | The run is complete. | The same, plus `value` (URLs), `sitemaps`, `failed` |
| `sitemap_cancel` | The user cancelled. | The same as `sitemap_done` |
| `sitemap_error` | The run failed. | The same as `sitemap_load`, plus `error` (the error code) |
| `view` | The user selects a view tab. | `label` (`tree`, `treemap`, `sunburst`, `table`, `stats`) |
| `export` | The user saves a file. | `label` (`svg`, `csv`, `json`), `view` |
| `sitemap_filter` | The user includes or excludes sitemap files. | `label` (`include`, `exclude`, `include_all`, `exclude_all`) |
| `confirm` | The user answers a dialog. | `label` (`cross_host`, `robots`), `value` (1 = yes) |

Google Analytics gets the event name and all params. Register the params as custom dimensions in GA4 to see them in
reports. Matomo gets an event with category `sitemap`, the event name as the action, `label` as the name, and `value` as
the value. Pasted text and uploaded files send no content and no file name.

A run sends the sitemap address that the user typed. If your privacy notice does not permit that, remove the `label`
and `host` params in `runParams()` in `assets/js/app.js`.

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
| Open proxy, content relay | The response must start as a `<urlset>` or `<sitemapindex>` document (gzip is inflated for the check). HTML, SVG, JSON, and a DOCTYPE are refused. The raw `robots.txt` text is never sent: `mode=robots` gives only valid `Sitemap:` addresses and the rules for our agent. |
| Downloads that the site owner denies | The proxy obeys `robots.txt` (RFC 9309) on each redirect hop: the `SitemapBuilder` group, or the `*` group. The data is kept for 1 hour, maximum 512 KB. If `robots.txt` is absent or not available, all paths are permitted. `/bot` tells site owners how to block the proxy. |
| Proxy response runs in a browser | `application/octet-stream`, `nosniff`, `Content-Disposition: attachment`, CSP `sandbox`. |
| Use of the proxy from other sites | `Sec-Fetch-Site: same-origin` (or a same-host Origin/Referer) is necessary. No CORS headers are sent. |
| DoS relay, bandwidth abuse | For each client: 60 requests / 5 minutes and 200 MB / hour. Global: 600 requests / 5 minutes. 15 MB for each file. 20 s timeout. Honest User-Agent (`SitemapBuilder/1.0`), thus site owners can block it. |
| Very large crawls | Browser limits: 500 sitemap files, 250,000 URLs, index depth 3, 3 parallel downloads, cycle detection, cancel button. |
| Crawl of a third-party host through an index | The user must confirm one time before downloads from an unrelated host. |
| Gzip and XML entity bombs | Byte caps on the download and on the inflated data. A DOCTYPE is refused before the XML parser runs. |
| XSS through sitemap values | Untrusted text goes to the DOM only as text nodes. Links permit only http(s). Strict CSP: no inline script or style, no third-party origins (only the validated analytics origins when a tracker is on). |
| CSV formula injection | Cells that start with `= + - @` get a leading apostrophe. |
| Drive-by crawl from a link | `?url=` only fills the field. A download starts only after a user action. |
| Exposure of private files | `.htaccess` denies dotfiles, `src/`, `var/`, `tests/`, `*.md`, and `*.ini`. Each private directory has a second deny file. `src/*.php` exit if called directly. |

The proxy target URL is in the query string, thus it is recorded in the Apache access log. The app has no other logs.
It sets no cookies and loads no third-party code unless `.env` turns a tracker on (see [Analytics](#analytics)).

The base Content-Security-Policy is in three places: `.htaccess` (static files), `csp()` in `src/layout.php` (the HTML
pages, which add the analytics origins), and `tests/router.php` (static files in development). Keep them the same.

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
php tests/robots_test.php
php tests/env_test.php
```

The proxy refuses `127.0.0.1` by design, thus local fixtures work only through the direct (CORS) path.

## Credits

Built and hosted by [EncodeDotHost](https://encode.host). Charts use [D3](https://d3js.org) (ISC licence).
