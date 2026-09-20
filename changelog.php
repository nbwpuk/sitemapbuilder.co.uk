<?php
declare(strict_types=1);

// Changelog page. It reads no user input. The content comes from CHANGELOG.md.

const SMB = 1;
require __DIR__ . '/src/layout.php';
require __DIR__ . '/src/changelog.php';

$markdown = (string) @file_get_contents(__DIR__ . '/CHANGELOG.md');

page_start(
    'Changelog - Sitemap Builder',
    'The changes in each release of Sitemap Builder.',
    false
);
?>
<main>
  <article class="panel prose">
    <h1>Changelog</h1>
<?= $markdown === '' ? '    <p>The changelog is not available.</p>' : changelog_html($markdown, app_version()) ?>

    <p class="back"><a href="/">Back to Sitemap Builder</a></p>
  </article>
</main>
<?php page_end(false);
