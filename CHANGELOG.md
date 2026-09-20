# Changelog

The important changes in each release of Sitemap Builder. The newest release is first.

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
