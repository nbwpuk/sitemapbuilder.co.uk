<?php
declare(strict_types=1);

// Page shell. It reads no user input. The only dynamic value is the asset version.

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

$a = '/assets/v-' . asset_version(__DIR__ . '/assets');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
?>
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sitemap Builder - see your XML sitemap as a tree, treemap, sunburst, and table</title>
<meta name="description" content="Enter an XML sitemap URL. Sitemap Builder follows sitemap index files and shows all URLs as a tree, treemap, sunburst, table, and statistics. All processing occurs in your browser.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="<?= $a ?>/css/app.css">
<script src="<?= $a ?>/vendor/d3.v7.min.js" defer></script>
<script type="module" src="<?= $a ?>/js/app.js"></script>
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><img src="/favicon.svg" alt="" width="28" height="28"> Sitemap Builder</a>
  <p class="tagline">Turn an XML sitemap into a picture of your site.</p>
</header>

<main>
  <section class="panel" aria-labelledby="input-title">
    <h1 id="input-title">Load a sitemap</h1>
    <div class="tabs" role="tablist" aria-label="Input method">
      <button type="button" role="tab" id="in-tab-url" aria-controls="in-url" aria-selected="true">URL</button>
      <button type="button" role="tab" id="in-tab-paste" aria-controls="in-paste" aria-selected="false" tabindex="-1">Paste XML</button>
      <button type="button" role="tab" id="in-tab-file" aria-controls="in-file" aria-selected="false" tabindex="-1">Upload file</button>
    </div>

    <form id="in-url" role="tabpanel" aria-labelledby="in-tab-url" class="input-row">
      <label class="visually-hidden" for="url-field">Sitemap URL</label>
      <input id="url-field" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" required placeholder="https://example.com/sitemap.xml">
      <button type="submit" class="primary">Build</button>
    </form>

    <form id="in-paste" role="tabpanel" aria-labelledby="in-tab-paste" hidden>
      <label for="paste-field">Sitemap XML (a URL set or a sitemap index)</label>
      <textarea id="paste-field" rows="8" spellcheck="false" required></textarea>
      <button type="submit" class="primary">Build</button>
    </form>

    <form id="in-file" role="tabpanel" aria-labelledby="in-tab-file" hidden>
      <label for="file-field">Sitemap file (.xml, .xml.gz, or .txt)</label>
      <input id="file-field" type="file" accept=".xml,.gz,.txt,application/xml,text/xml,application/gzip,text/plain" required>
      <button type="submit" class="primary">Build</button>
    </form>

    <p class="hint">Your browser downloads and reads the sitemap. If a site blocks direct browser access, our server gets the file for you. We do not store sitemap data.</p>
  </section>

  <section id="progress" class="panel" aria-labelledby="progress-title" hidden>
    <div class="panel-head">
      <h2 id="progress-title">Progress</h2>
      <button type="button" id="cancel-btn">Cancel</button>
    </div>
    <p id="progress-summary" role="status" aria-live="polite"></p>
    <div id="messages"></div>
    <details id="progress-details">
      <summary>Sitemap files</summary>
      <ul id="progress-list" class="progress-list"></ul>
    </details>
  </section>

  <section id="results" aria-labelledby="results-title" hidden>
    <h2 id="results-title" class="visually-hidden">Results</h2>
    <div id="tiles" class="tiles"></div>

    <div class="panel">
      <div class="panel-head">
        <div class="tabs" role="tablist" aria-label="View">
          <button type="button" role="tab" id="v-tab-tree" aria-controls="view" data-view="tree" aria-selected="true">Tree</button>
          <button type="button" role="tab" id="v-tab-treemap" aria-controls="view" data-view="treemap" aria-selected="false" tabindex="-1">Treemap</button>
          <button type="button" role="tab" id="v-tab-sunburst" aria-controls="view" data-view="sunburst" aria-selected="false" tabindex="-1">Sunburst</button>
          <button type="button" role="tab" id="v-tab-table" aria-controls="view" data-view="table" aria-selected="false" tabindex="-1">Table</button>
          <button type="button" role="tab" id="v-tab-stats" aria-controls="view" data-view="stats" aria-selected="false" tabindex="-1">Statistics</button>
        </div>
        <div class="exports">
          <button type="button" id="export-svg">Save SVG</button>
          <button type="button" id="export-csv">Save CSV</button>
          <button type="button" id="export-json">Save JSON</button>
        </div>
      </div>
      <div id="view" role="tabpanel" class="view viz-root"></div>
    </div>
  </section>
</main>

<dialog id="confirm-dialog" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Sitemap on a different host</h2>
  <p id="confirm-text"></p>
  <div class="dialog-actions">
    <button type="button" id="confirm-no">Skip these files</button>
    <button type="button" id="confirm-yes" class="primary">Download them</button>
  </div>
</dialog>

<div id="tooltip" class="tooltip" role="presentation" hidden></div>

<footer class="site-footer">
  <p>Sitemap Builder uses no cookies and no analytics. Our downloader identifies itself as <code>SitemapBuilder/1.0</code>.</p>
  <p>Built and hosted by <a href="https://encode.host" target="_blank" rel="noopener">EncodeDotHost</a>.</p>
  <noscript><p>This tool needs JavaScript.</p></noscript>
</footer>
</body>
</html>
