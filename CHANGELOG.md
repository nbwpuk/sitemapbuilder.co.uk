# Changelog

The important changes in each release of Sitemap Builder. The newest release is first.

## 1.4.0 - 2026-09-20

### Added
- You can type an address without `https://`. The tool adds it.
- You can type only a domain. The tool reads the `Sitemap:` lines in `robots.txt`. If there are none, it uses `/sitemap.xml`.
- Our server obeys `robots.txt`. If a rule denies a sitemap file, our server does not download it, and the tool asks you before your browser tries a direct download.
- A page for site owners about the `SitemapBuilder` user agent: https://www.sitemapbuilder.co.uk/bot

### Changed
- The user agent of our server now has a link to the bot page.

## 1.3.0 - 2026-09-20

### Added
- A list of the sitemap files above the views. Clear a check box to exclude a file from the diagrams, the table, the statistics, and the exports.
- A URL that occurs in more than one file stays in the views while one of its files is included.
- The footer shows the version number, with a link to that release in the changelog.
- The footer has a link to the source code on GitHub.

## 1.2.0 - 2026-09-20

### Added
- A changelog page, with a link in the footer.

## 1.1.0 - 2026-09-20

### Changed
- All addresses now redirect to `https://www.sitemapbuilder.co.uk`.
- The footer stays at the bottom of the page when the content is short.
- The downloader now permits sitemaps from other sites on our own server.

### Fixed
- The SVG file of the tree view now contains the full tree. Before, the file showed only the part that was on the screen.
- SVG files are much smaller.

### Security
- The downloader refuses host names that end with a dot.
- The downloader checks the address of each connection after the download.
- The downloader refuses gzip data that it cannot examine.

## 1.0.0 - 2026-09-20

### Added
- Load a sitemap from a URL, from pasted XML, or from a file (`.xml`, `.xml.gz`, `.txt`).
- Sitemap index files: the app follows them to all sub-sitemaps.
- Five views: tree, treemap, sunburst, table, and statistics.
- Save the results as SVG, CSV, or JSON.
- Light and dark colour modes.
- A download service for sites that block direct browser access. It accepts only sitemap files.
