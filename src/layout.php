<?php
declare(strict_types=1);

defined('SMB') || exit;

// Shared page parts. These functions read no user input.

/**
 * Short hash of path + mtime + size of each file in assets/.
 * A change to any asset gives a new /assets/v-<hash>/ prefix, thus a new URL for each script.
 */
function asset_version(string $dir): string
{
    $parts = [];
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($files as $file) {
        if ($file->isFile()) {
            $parts[] = $file->getPathname() . '|' . $file->getMTime() . '|' . $file->getSize();
        }
    }
    sort($parts);
    return substr(sha1(implode("\n", $parts)), 0, 10);
}

function asset_prefix(): string
{
    return '/assets/v-' . asset_version(dirname(__DIR__) . '/assets');
}

/** The version of the newest release: the first "## x.y.z" heading in CHANGELOG.md. Empty if there is none. */
function app_version(): string
{
    $markdown = (string) @file_get_contents(dirname(__DIR__) . '/CHANGELOG.md');
    return preg_match('/^## (\d+\.\d+\.\d+)\b/m', $markdown, $m) === 1 ? $m[1] : '';
}

function e(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

/** Send headers and print the document head and the site header. `$app` adds the D3 and app scripts. */
function page_start(string $title, string $description, bool $app): void
{
    $a = asset_prefix();
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    ?>
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($description) ?>">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="<?= $a ?>/css/app.css">
<?php if ($app): ?>
<script src="<?= $a ?>/vendor/d3.v7.min.js" defer></script>
<script type="module" src="<?= $a ?>/js/app.js"></script>
<?php endif; ?>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><img src="/favicon.svg" alt="" width="28" height="28"> Sitemap Builder</a>
  <p class="tagline">Turn an XML sitemap into a picture of your site.</p>
</header>
<?php
}

function page_end(bool $app): void
{
    $version = app_version();
    ?>
<footer class="site-footer">
  <p>Sitemap Builder uses no cookies and no analytics. Our downloader identifies itself as <code>SitemapBuilder/1.0</code>.</p>
  <p>Built and hosted by <a href="https://encode.host" target="_blank" rel="noopener">EncodeDotHost</a>. <?php if ($version !== ''): ?>Version <a href="/changelog#v<?= e($version) ?>"><?= e($version) ?></a>.<?php else: ?><a href="/changelog">Changelog</a>.<?php endif; ?> <a href="https://github.com/nbwpuk/sitemapbuilder.co.uk" target="_blank" rel="noopener">Source code on GitHub</a>.</p>
<?php if ($app): ?>
  <noscript><p>This tool needs JavaScript.</p></noscript>
<?php endif; ?>
</footer>
</body>
</html>
<?php
}
