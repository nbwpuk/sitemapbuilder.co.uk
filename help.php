<?php
declare(strict_types=1);

// Help page for users. It reads no user input.
// assets/js/help.js makes the two tab rows. Without JavaScript, all panels show one below the other.
// The figures in src/help/ are static SVG drawings of one example site (www.example.com, 235 URLs).
// tests/help_figures.mjs makes them. They use the same classes as the views, thus they follow the theme.

const SMB = 1;
require __DIR__ . '/src/layout.php';

/** Print one figure SVG from src/help/. The files are ours, not user input. */
function help_svg(string $name): void
{
    $svg = @file_get_contents(__DIR__ . '/src/help/' . $name . '.svg');
    echo $svg === false ? '' : $svg;
}

page_start(
    'Help - Sitemap Builder',
    'How to use Sitemap Builder: what it shows about your site, how to load a sitemap, and what each view and export contains.',
    '/help',
    false,
    'help'
);
?>
<main>
  <article class="panel prose help">
    <h1>Help</h1>
    <p>Sitemap Builder reads an XML sitemap and shows all of its URLs as diagrams, a table, and statistics. This page tells you what the tool does for you, how to use it, and what each view shows.</p>

    <div class="tabs" role="tablist" aria-label="Help sections">
      <button type="button" role="tab" id="tab-overview" aria-controls="overview" aria-selected="true">Overview</button>
      <button type="button" role="tab" id="tab-how" aria-controls="how" aria-selected="false" tabindex="-1">How to use it</button>
      <button type="button" role="tab" id="tab-views" aria-controls="views" aria-selected="false" tabindex="-1">The views</button>
      <button type="button" role="tab" id="tab-save" aria-controls="save" aria-selected="false" tabindex="-1">Save the data</button>
      <button type="button" role="tab" id="tab-problems" aria-controls="problems" aria-selected="false" tabindex="-1">Messages and problems</button>
    </div>

    <section id="overview" role="tabpanel" aria-labelledby="tab-overview">
      <h2>What the tool does for you</h2>
      <p>A sitemap tells search engines which pages a site has. A large sitemap is a long list of addresses, and a list does not show the shape of a site. Sitemap Builder changes that list into a picture. Use it to:</p>
      <ul>
        <li><strong>See the structure of a site.</strong> The tree, treemap, and sunburst put each URL in its folder, thus you see the sections and how deep they go.</li>
        <li><strong>Find the largest sections.</strong> A large area or a long bar shows where most of the pages are.</li>
        <li><strong>Find pages that are too deep.</strong> The depth chart shows how many URLs are far from the home page.</li>
        <li><strong>Check the dates.</strong> The tool counts the URLs with a <code>lastmod</code> date and shows the dates by month. Old or missing dates are easy to see.</li>
        <li><strong>Compare sitemap files.</strong> See how many URLs each file supplies, find files that failed, and remove files from the views to compare them.</li>
        <li><strong>Find problems in the sitemap.</strong> The tool counts duplicate URLs, files that failed, images, videos, and <code>hreflang</code> links.</li>
        <li><strong>Save the data.</strong> Save a diagram as SVG, the URL list as CSV, or the full tree as JSON.</li>
      </ul>
      <p>The tool is free and needs no account. Your browser reads the sitemap and draws all views. If a site blocks direct browser access, our server downloads the file for you. We do not store sitemap data.</p>
    </section>

    <section id="how" role="tabpanel" aria-labelledby="tab-how">
      <h2>How to use it</h2>
      <h3>1. Load a sitemap</h3>
      <p>The <a href="/">home page</a> has three tabs. Select one:</p>
      <dl>
        <dt>URL</dt>
        <dd>Type the address of a sitemap, for example <code>example.com/sitemap.xml</code>, and select <strong>Build</strong>. If you do not type <code>https://</code>, the tool adds it. If you type only a domain, for example <code>example.com</code>, the tool reads the <code>Sitemap:</code> lines in the <code>robots.txt</code> file of the site. If there are none, it uses <code>/sitemap.xml</code>.</dd>
        <dt>Paste XML</dt>
        <dd>Paste the text of a sitemap (a URL set or a sitemap index) and select <strong>Build</strong>.</dd>
        <dt>Upload file</dt>
        <dd>Select a <code>.xml</code>, <code>.xml.gz</code>, or <code>.txt</code> file and select <strong>Build</strong>. A <code>.txt</code> file has one URL on each line. Pasted text and uploaded files do not go to our server.</dd>
      </dl>

      <h3>2. Watch the progress</h3>
      <p>The <strong>Progress</strong> panel shows how many sitemap files the tool has read and how many URLs it has found. Open <strong>Sitemap files</strong> to see each file, its status, its number of URLs, and its size. Select <strong>Cancel</strong> to stop. The tool then shows the URLs that it found before you stopped it.</p>
      <p>A sitemap index points to other sitemap files. The tool follows these files automatically. The tool can ask you two questions:</p>
      <ul>
        <li><strong>Sitemap on a different host.</strong> The index points to files on a different site. Select <strong>Download them</strong> or <strong>Skip these files</strong>.</li>
        <li><strong>Denied by robots.txt.</strong> The <code>robots.txt</code> file of the site does not permit our server to download some sitemap files. Select <strong>Try a direct download</strong> to let your browser try, or <strong>Skip these files</strong>. See <a href="/bot">About the bot</a>.</li>
      </ul>

      <h3>3. Look at the results</h3>
      <p>The results have three parts: the summary tiles, the list of sitemap files, and the view panel. Select a tab in the view panel to change the view: <strong>Tree</strong>, <strong>Treemap</strong>, <strong>Sunburst</strong>, <strong>Table</strong>, or <strong>Statistics</strong>. See <a href="#tiles">The views</a>. Use the <strong>Save SVG</strong>, <strong>Save CSV</strong>, and <strong>Save JSON</strong> buttons to save the data. See <a href="#save">Save the data</a>.</p>

      <h3>4. Include or exclude sitemap files</h3>
      <p>If two or more sitemap files have URLs, the panel <strong>Sitemap files in the views</strong> shows above the views. Clear the check box of a file to remove its URLs from the diagrams, the table, the statistics, and the exports. Use <strong>Include all</strong> and <strong>Exclude all</strong> to change all files. If a URL is in more than one file, it stays in the views while one or more of its files is included.</p>

      <h3>Tip: share a link</h3>
      <p>A link such as <code>https://www.sitemapbuilder.co.uk/?url=https://example.com/sitemap.xml</code> puts the address in the field. The download starts only when you select <strong>Build</strong>.</p>
    </section>

    <section id="views" role="tabpanel" aria-labelledby="tab-views">
      <h2>The views</h2>
      <p>The figures show one example site, <code>www.example.com</code>. Its sitemap index points to two files: <code>post-sitemap.xml</code> (120 URLs) and <code>page-sitemap.xml</code> (115 URLs). The site has 235 URLs in four sections: <code>/blog</code>, <code>/products</code>, <code>/help</code>, and <code>/about</code>. The figures are drawings. In the tool, all views are interactive.</p>

      <div class="tabs sub" role="tablist" aria-label="Views">
        <button type="button" role="tab" id="tab-tiles" aria-controls="tiles" aria-selected="true">Summary tiles</button>
        <button type="button" role="tab" id="tab-tree" aria-controls="tree" aria-selected="false" tabindex="-1">Tree</button>
        <button type="button" role="tab" id="tab-treemap" aria-controls="treemap" aria-selected="false" tabindex="-1">Treemap</button>
        <button type="button" role="tab" id="tab-sunburst" aria-controls="sunburst" aria-selected="false" tabindex="-1">Sunburst</button>
        <button type="button" role="tab" id="tab-table" aria-controls="table" aria-selected="false" tabindex="-1">Table</button>
        <button type="button" role="tab" id="tab-stats" aria-controls="stats" aria-selected="false" tabindex="-1">Statistics</button>
      </div>

      <section id="tiles" role="tabpanel" aria-labelledby="tab-tiles">
        <h3>Summary tiles</h3>
        <p>Six tiles above the views give the main numbers for the sitemap.</p>
        <figure class="figure">
          <div class="tiles" role="img" aria-label="Example summary tiles">
            <div class="tile"><div class="label">URLs</div><div class="value">235</div><div class="note">No duplicates</div></div>
            <div class="tile"><div class="label">Sitemap files</div><div class="value">3</div><div class="note">All read</div></div>
            <div class="tile"><div class="label">Hosts</div><div class="value">1</div></div>
            <div class="tile"><div class="label">Deepest path</div><div class="value">3</div><div class="note">levels below the home page</div></div>
            <div class="tile"><div class="label">With lastmod</div><div class="value">93%</div><div class="note">220 URLs</div></div>
            <div class="tile"><div class="label">Images / videos</div><div class="value">347 / 4</div></div>
          </div>
          <figcaption>The summary tiles for the example site.</figcaption>
        </figure>
        <dl>
          <dt>URLs</dt>
          <dd>The number of unique URLs. If a URL is in the sitemap more than one time, the tool counts it one time and shows the number of duplicates that it removed.</dd>
          <dt>Sitemap files</dt>
          <dd>All files that the tool read, index files included. The note shows the number of files that failed, and the number of files that you excluded.</dd>
          <dt>Hosts</dt>
          <dd>The number of different host names in the URLs, for example <code>www.example.com</code> and <code>shop.example.com</code>.</dd>
          <dt>Deepest path</dt>
          <dd>The largest number of folders in a URL path. The home page is depth 0. <code>/products/shoes/item-1</code> is depth 3.</dd>
          <dt>With lastmod</dt>
          <dd>The percentage of URLs that have a <code>lastmod</code> date.</dd>
          <dt>Images / videos</dt>
          <dd>The number of image and video entries (Google image and video sitemap tags). If the sitemap has <code>hreflang</code> links, the note shows their number.</dd>
        </dl>
      </section>

      <section id="tree" role="tabpanel" aria-labelledby="tab-tree">
        <h3>Tree</h3>
        <p>The tree shows each folder of the site as a node. The site is at the left, and each level is one step to the right. Use the tree to see the full structure and to find one page.</p>
        <figure class="figure">
          <div class="toolbar-sample" aria-hidden="true"><span>Open one more level</span><span>Close one level</span><span>Reset position</span></div>
          <div class="wide">
<?php help_svg('tree'); ?>
          </div>
          <figcaption>The example site in the tree. The number after a name is the number of URLs in that branch. <code>/blog</code> and <code>/products</code> are open. <code>/help</code> and <code>/about</code> are closed.</figcaption>
        </figure>
        <ul>
          <li>A circle with a fill is a closed branch. Select it to open it. Select an open branch to close it.</li>
          <li>A grey circle is a page with no pages below it.</li>
          <li>The tree opens two levels at the start. Use <strong>Open one more level</strong> and <strong>Close one level</strong> to change all branches.</li>
          <li>Drag to move the tree. Use the mouse wheel or a pinch to zoom. <strong>Reset position</strong> puts the tree back in view.</li>
          <li>A node shows its first 200 children. A <strong>Show 200 more</strong> node shows the next 200.</li>
          <li>Select a node to see its URL, its number of URLs, and its <code>lastmod</code> date above the tree. A folder that is not a page in the sitemap shows "(not a page in the sitemap)".</li>
          <li><strong>Save SVG</strong> saves the full tree, not only the part that you see.</li>
        </ul>
      </section>

      <section id="treemap" role="tabpanel" aria-labelledby="tab-treemap">
        <h3>Treemap</h3>
        <p>The treemap shows each section as a rectangle. The area of a rectangle is the number of URLs. The colour shows the top-level section. Use the treemap to compare the size of sections.</p>
        <figure class="figure">
          <div class="wide">
<?php help_svg('treemap'); ?>
          </div>
          <div class="legend" aria-hidden="true">
            <span class="key s1"><span class="swatch"></span>blog</span>
            <span class="key s2"><span class="swatch"></span>products</span>
            <span class="key s3"><span class="swatch"></span>help</span>
            <span class="key s4"><span class="swatch"></span>about</span>
          </div>
          <figcaption>The example site in the treemap. <code>/blog</code> has 120 of 235 URLs, thus it fills approximately half of the area.</figcaption>
        </figure>
        <ul>
          <li>The treemap shows two levels below the current node.</li>
          <li>Select a rectangle to zoom in to its section. The path at the top shows where you are. Select a name in the path to go back up.</li>
          <li>Put the pointer on a rectangle to see its path, its number of URLs, and its percentage of the view.</li>
          <li>The first eight sections each have a colour. The other sections are grey, with the name "Other".</li>
          <li>"(this page)" is the page of the folder itself, for example <code>/blog/</code>. "N more" is a group of small branches.</li>
        </ul>
      </section>

      <section id="sunburst" role="tabpanel" aria-labelledby="tab-sunburst">
        <h3>Sunburst</h3>
        <p>The sunburst shows the site as rings. The centre is the current node. Each ring is one level deeper. The angle of a segment is the number of URLs. Use the sunburst to see how a section divides into subsections.</p>
        <figure class="figure">
          <div class="sunburst">
<?php help_svg('sunburst'); ?>
          </div>
          <figcaption>The example site in the sunburst. The inner ring has the four sections. The outer rings have the subsections and the pages.</figcaption>
        </figure>
        <ul>
          <li>The sunburst shows three rings below the current node.</li>
          <li>Select a segment to zoom in. Select the centre to go up one level.</li>
          <li>The centre shows the number of URLs in the view and the name of the current node.</li>
          <li>The sunburst and the treemap use the same colours and the same zoom position.</li>
        </ul>
      </section>

      <section id="table" role="tabpanel" aria-labelledby="tab-table">
        <h3>Table</h3>
        <p>The table shows one row for each URL. Use the table to find, filter, and sort URLs.</p>
        <figure class="figure">
          <div class="toolbar-sample" aria-hidden="true"><span>Filter URLs (text)</span><span>All sitemaps</span><span class="here">235 of 235 URLs</span></div>
          <div class="vt vt-static" role="img" aria-label="Example table rows">
            <div class="vt-scroll-x"><div class="vt-inner">
              <div class="vt-head"><div>URL</div><div>Last modified ▼</div><div>Change freq.</div><div>Priority</div><div>Depth</div><div>Sitemap</div></div>
              <div class="vt-row"><div class="loc">https://www.example.com/blog/2026/post-27</div><div>2026-10-14</div><div>weekly</div><div class="num">0.6</div><div class="num">3</div><div>post-sitemap.xml</div></div>
              <div class="vt-row"><div class="loc">https://www.example.com/products/shoes/item-12</div><div>2026-10-02 09:30</div><div>daily</div><div class="num">0.8</div><div class="num">3</div><div>page-sitemap.xml</div></div>
              <div class="vt-row"><div class="loc">https://www.example.com/help/article-4</div><div>2026-09-18</div><div>monthly</div><div class="num">0.5</div><div class="num">2</div><div>page-sitemap.xml</div></div>
              <div class="vt-row"><div class="loc">https://www.example.com/</div><div>2026-09-01</div><div>daily</div><div class="num">1.0</div><div class="num">0</div><div>page-sitemap.xml</div></div>
              <div class="vt-row"><div class="loc">https://www.example.com/about/team</div><div></div><div></div><div class="num"></div><div class="num">2</div><div>page-sitemap.xml</div></div>
            </div></div>
          </div>
          <figcaption>Five rows of the example site, sorted by <strong>Last modified</strong>, newest first. An empty cell means that the sitemap has no value.</figcaption>
        </figure>
        <dl>
          <dt>URL</dt><dd>The address from the <code>&lt;loc&gt;</code> tag. Select it to open the page in a new tab.</dd>
          <dt>Last modified</dt><dd>The <code>&lt;lastmod&gt;</code> date, and the time if the sitemap gives one.</dd>
          <dt>Change freq. and Priority</dt><dd>The <code>&lt;changefreq&gt;</code> and <code>&lt;priority&gt;</code> values.</dd>
          <dt>Depth</dt><dd>The number of folders in the path. The home page is 0.</dd>
          <dt>Sitemap</dt><dd>The file that supplied the URL. Put the pointer on it to see the full address.</dd>
        </dl>
        <ul>
          <li>Type in <strong>Filter URLs</strong> to show only the URLs that contain the text.</li>
          <li>Select a file in <strong>All sitemaps</strong> to show only the URLs from that file.</li>
          <li>Select a column name to sort. Select it again to change the direction. Select it a third time to stop the sort.</li>
          <li>The table shows 250,000 rows without problems: it draws only the rows that you can see.</li>
        </ul>
      </section>

      <section id="stats" role="tabpanel" aria-labelledby="tab-stats">
        <h3>Statistics</h3>
        <p>The statistics view has four charts. Put the pointer on a bar to see its value. Below each chart, <strong>Show the data as a table</strong> shows the numbers.</p>
        <figure class="figure">
          <div class="charts">
            <section class="chart">
              <h3>Largest sections</h3>
              <p class="sub">Number of URLs below each top-level path.</p>
<?php help_svg('sections'); ?>
            </section>
            <section class="chart">
              <h3>Path depth</h3>
              <p class="sub">Number of URLs at each depth. Depth 0 is the home page.</p>
<?php help_svg('depth'); ?>
            </section>
            <section class="chart">
              <h3>Last modified, by month</h3>
              <p class="sub">220 of 235 URLs have a lastmod value.</p>
<?php help_svg('months'); ?>
            </section>
          </div>
          <figcaption>Three of the four charts for the example site. Most URLs are at depth 3: the blog posts and the product pages.</figcaption>
        </figure>
        <dl>
          <dt>Largest sections</dt>
          <dd>The number of URLs below each top-level folder. The chart shows the largest 12. The table shows all.</dd>
          <dt>URLs for each sitemap file</dt>
          <dd>The number of unique URLs that each file supplied. A file with 0 URLs can be a problem. The chart shows the largest 12. The table shows all.</dd>
          <dt>Path depth</dt>
          <dd>The number of URLs at each depth. Many URLs at a large depth can mean that users and search engines need many clicks to find them.</dd>
          <dt>Last modified, by month</dt>
          <dd>The number of URLs with a <code>lastmod</code> date in each month. The chart shows the last 36 months. The text above the chart tells you how many URLs have a date, and how many older URLs are not in the chart.</dd>
        </dl>
      </section>
    </section>

    <section id="save" role="tabpanel" aria-labelledby="tab-save">
      <h2>Save the data</h2>
      <p>The buttons above the views save files to your computer. Your browser makes the files. No data goes to our server.</p>
      <dl>
        <dt>Save SVG</dt>
        <dd>Saves the current diagram (tree, treemap, or sunburst) as an SVG image. You can open it in a browser or a drawing program. The table and statistics views have no SVG.</dd>
        <dt>Save CSV</dt>
        <dd>Saves one row for each URL, for a spreadsheet. In the table view, the file has the rows that the filters show, in the sort order. In the other views, it has all URLs.</dd>
        <dt>Save JSON</dt>
        <dd>Saves the list of sitemap files and the full tree, for other programs.</dd>
      </dl>
      <figure class="figure">
<pre><code>url,lastmod,changefreq,priority,depth,images,videos,alternates,sitemap
https://www.example.com/,2026-09-01,daily,1.0,0,0,0,0,https://www.example.com/page-sitemap.xml
https://www.example.com/blog/2026/post-27,2026-10-14,weekly,0.6,3,1,0,0,https://www.example.com/post-sitemap.xml
https://www.example.com/products/shoes/item-12,2026-10-02T09:30:00+01:00,daily,0.8,3,3,0,0,https://www.example.com/page-sitemap.xml</code></pre>
        <figcaption>The start of a CSV file. The <code>images</code>, <code>videos</code>, and <code>alternates</code> columns count the image, video, and <code>hreflang</code> tags of each URL.</figcaption>
      </figure>
      <figure class="figure">
<pre><code>{
 "generator": "sitemapbuilder.co.uk",
 "sitemaps": [
  { "url": "https://www.example.com/sitemap_index.xml", "type": "index", "status": "done", "count": 2 },
  { "url": "https://www.example.com/post-sitemap.xml", "type": "urlset", "status": "done", "count": 120 },
  …
 ],
 "tree": {
  "name": "www.example.com",
  "count": 235,
  "url": "https://www.example.com/",
  "children": [
   { "name": "blog", "count": 120, "url": "https://www.example.com/blog/", "children": [ … ] },
   …
  ]
 }
}</code></pre>
        <figcaption>The shape of a JSON file (shortened). Each node of the tree has a name, a count of URLs, and its children. A node that is a page also has its URL and <code>lastmod</code> date. An excluded sitemap file has <code>"excluded": true</code>.</figcaption>
      </figure>
    </section>

    <section id="problems" role="tabpanel" aria-labelledby="tab-problems">
      <h2>Messages and problems</h2>
      <p>The <strong>Progress</strong> panel shows a status for each sitemap file: <em>done</em>, <em>error</em>, <em>skipped</em>, or <em>cancelled</em>. A file that failed shows the reason. The other files still go into the views. If an entry is not a valid <code>http</code> or <code>https</code> URL, the tool ignores it and tells you how many entries it ignored.</p>
      <p>The tool has limits that keep your browser fast:</p>
      <ul>
        <li>500 sitemap files. If an index has more, the tool reads the first 500.</li>
        <li>250,000 URLs. If the site has more, the tool stops at the limit.</li>
        <li>Three levels of index files. The sitemap protocol does not permit an index in an index, but some sites use them.</li>
      </ul>
      <p>The tool shows a message when it gets to a limit. If the site does not let your browser download the sitemap, our server downloads it. Our server obeys <code>robots.txt</code>. If a sitemap does not load, examine the address, and make sure that the file is a sitemap and not an HTML page.</p>
      <p>To report a problem, use <a href="https://github.com/nbwpuk/sitemapbuilder.co.uk/issues" target="_blank" rel="noopener">GitHub</a>.</p>
    </section>

    <p class="back"><a href="/">Back to Sitemap Builder</a></p>
  </article>
</main>
<?php page_end(false);
