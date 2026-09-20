<?php
declare(strict_types=1);

// Information for site owners about our downloader. It reads no user input.

const SMB = 1;
require __DIR__ . '/src/layout.php';

page_start(
    'The SitemapBuilder bot - Sitemap Builder',
    'What the SitemapBuilder user agent does, and how to control it with robots.txt.',
    false
);
?>
<main>
  <article class="panel prose">
    <h1>The SitemapBuilder bot</h1>
    <p>You are here because <code>SitemapBuilder</code> is in your server logs. This page tells you what it does and how to control it.</p>

    <h2>What it is</h2>
    <p>Sitemap Builder is a free tool that makes diagrams from an XML sitemap. A person types the address of a sitemap, and the tool downloads that sitemap. It is not a search engine and it keeps no copy of your data.</p>
    <p>The browser of the person downloads the sitemap directly when your server permits that (CORS). If not, our server downloads it. Our server identifies itself with this user agent:</p>
    <pre><code>SitemapBuilder/1.0 (+https://www.sitemapbuilder.co.uk/bot)</code></pre>

    <h2>What it downloads</h2>
    <ul>
      <li>Your <code>/robots.txt</code> file, at most one time each hour.</li>
      <li>XML sitemap files and sitemap index files, only when a person asks for them. It refuses all other content.</li>
      <li>It does not download your pages, and it does not follow the links in your sitemap.</li>
      <li>It downloads at most three files at the same time, and it has rate limits for each person.</li>
    </ul>

    <h2>How to control it</h2>
    <p>Our server obeys <code>robots.txt</code> (RFC 9309). It uses the group for <code>SitemapBuilder</code>. If there is no such group, it uses the group for <code>*</code>. To block all downloads by our server:</p>
    <pre><code>User-agent: SitemapBuilder
Disallow: /</code></pre>
    <p>To permit your sitemap files when the <code>*</code> group denies them:</p>
    <pre><code>User-agent: SitemapBuilder
Allow: /sitemap.xml
Allow: /sitemaps/</code></pre>
    <p>Our server keeps your <code>robots.txt</code> data for one hour, thus a change can take one hour to have an effect.</p>
    <p>A direct download from the browser of a person does not come from our server and does not use our user agent. If <code>robots.txt</code> denies a sitemap, the tool tells the person before the browser tries a direct download.</p>

    <h2>Contact</h2>
    <p>Report a problem on <a href="https://github.com/nbwpuk/sitemapbuilder.co.uk/issues" target="_blank" rel="noopener">GitHub</a>.</p>

    <p class="back"><a href="/">Back to Sitemap Builder</a></p>
  </article>
</main>
<?php page_end(false);
