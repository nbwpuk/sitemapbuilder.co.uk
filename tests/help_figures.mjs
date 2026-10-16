// Make the static SVG figures for help.php in src/help/ from one example data set (www.example.com, 235 URLs).
// The script uses the real model.js, common.js, and D3 layouts, and copies the geometry of the views.
// Run it again after a change to a view, then update the numbers in help.php if they change.
// Use: node tests/help_figures.mjs   (run from the repository root)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = `${root}/src/help`;
const require = createRequire(import.meta.url);
const d3 = require(`${root}/assets/vendor/d3.v7.min.js`);
globalThis.d3 = d3;
const model = await import(pathToFileURL(`${root}/assets/js/model.js`));
const common = await import(pathToFileURL(`${root}/assets/js/views/common.js`));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Number(n).toLocaleString('en-GB');
const r1 = (n) => Math.round(n * 10) / 10;

/* ---------- Example data ---------- */
const host = 'https://www.example.com';
const urls = [];
let seq = 0;
const month = (i) => {
    const m = i % 34; // 2024-01 .. 2026-10
    const y = 2024 + Math.floor(m / 12);
    return `${y}-${String((m % 12) + 1).padStart(2, '0')}-1${i % 10}`;
};
const add = (path, sitemap, extra = {}) => {
    const i = seq++;
    urls.push({ loc: host + path, lastmod: i % 16 === 5 ? '' : month(i * 7), changefreq: '', priority: '', images: 0, videos: 0, alternates: 0, sitemap, ...extra });
};
add('/', 2);
add('/blog/', 1);
for (const [year, n] of [[2024, 48], [2025, 44], [2026, 27]]) for (let i = 1; i <= n; i++) add(`/blog/${year}/post-${i}`, 1, { images: 1 });
add('/products/', 2);
for (const [cat, n] of [['shoes', 40], ['bags', 25], ['hats', 11]]) {
    add(`/products/${cat}/`, 2);
    for (let i = 1; i <= n; i++) add(`/products/${cat}/item-${i}`, 2, { images: 3 });
}
add('/help/', 2);
for (let i = 1; i <= 29; i++) add(`/help/article-${i}`, 2, { videos: i <= 4 ? 1 : 0 });
add('/about/', 2);
for (const p of ['team', 'contact', 'jobs']) add(`/about/${p}`, 2);

const sitemaps = [
    { id: 0, url: `${host}/sitemap_index.xml`, type: 'index', status: 'done', count: 2 },
    { id: 1, url: `${host}/post-sitemap.xml`, type: 'urlset', status: 'done', count: 120 },
    { id: 2, url: `${host}/page-sitemap.xml`, type: 'urlset', status: 'done', count: 115 },
];
const tree = model.buildTree(urls);
const stats = model.buildStats({ urls, sitemaps, excluded: new Set(), duplicates: 0, invalid: 0 }, tree);
const classes = common.assignSectionColours(tree);

/* ---------- Tree (same geometry as views/tree.js) ---------- */
{
    const ROW = 20, COLUMN = 230;
    const open = new Set(['www.example.com', 'blog', 'products']);
    const h = d3.hierarchy(tree, (n) => (open.has(n.name) && n.depth < 2 ? n.children : null));
    d3.tree().nodeSize([ROW, COLUMN])(h);
    const nodes = h.descendants();
    const [x0, x1] = d3.extent(nodes, (d) => d.x);
    const left = 190, top = 16;
    const width = left + 2 * COLUMN + 130, height = x1 - x0 + 2 * top;
    const link = d3.linkHorizontal().x((d) => d.y + left).y((d) => d.x - x0 + top);
    let s = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Example tree of www.example.com">\n<g>`;
    for (const l of h.links()) s += `<path class="tree-link" d="${link(l).replace(/(\d+\.\d+)/g, (m) => r1(+m))}"/>`;
    s += '</g>\n<g>';
    for (const d of nodes) {
        const n = d.data;
        const kids = n.children.length > 0;
        const isOpen = kids && open.has(n.name) && d.depth < 2;
        const cls = ['tree-node', kids ? (isOpen ? 'open' : 'closed') : 'leaf', n.entry ? 'page' : ''].join(' ').trim();
        const label = esc(common.fitText(n.name, COLUMN - 70));
        const count = kids ? `<tspan class="n" dx="6">${fmt(n.count)}</tspan>` : '';
        s += `\n<g class="${cls}" transform="translate(${d.y + left},${d.x - x0 + top})"><circle r="5"/><text dy="0.32em" x="${isOpen ? -10 : 10}" text-anchor="${isOpen ? 'end' : 'start'}">${label}${count}</text></g>`;
    }
    s += '\n</g></svg>';
    writeFileSync(`${out}/tree.svg`, s);
}

/* ---------- Treemap (same layout as views/treemap.js) ---------- */
{
    const width = 720, height = 360, HEADER = 20;
    const hasHeader = (d) => d.value / d.parent.value > 0.02;
    const h = d3.hierarchy(common.truncate(tree, 2)).sum((d) => (d.children ? 0 : d.value)).sort((a, b) => b.value - a.value);
    d3.treemap().size([width, height]).paddingOuter(2).paddingInner(2)
        .paddingTop((d) => (d.depth === 1 && d.children && hasHeader(d) ? HEADER : 2)).round(true)(h);
    let s = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Example treemap of www.example.com">\n`;
    for (const d of h.children.filter((d) => d.children)) {
        s += `<g transform="translate(${d.x0},${d.y0})"><rect class="group-bg" rx="3" width="${d.x1 - d.x0}" height="${d.y1 - d.y0}"/>`;
        if (hasHeader(d)) s += `<text class="group-label" x="5" y="14">${esc(common.fitText(`${common.nodeLabel(d.data)}  ${fmt(d.value)}`, d.x1 - d.x0 - 8, 7))}</text>`;
        s += '</g>\n';
    }
    for (const d of h.leaves()) {
        const owner = d.data.ref ?? d.data.otherOf;
        const cls = owner === tree ? 's-other' : common.colourClass(owner, classes);
        const w = d.x1 - d.x0, hh = d.y1 - d.y0;
        s += `<g class="cell ${cls}" transform="translate(${d.x0},${d.y0})"><rect rx="2" width="${Math.max(0, w)}" height="${Math.max(0, hh)}"/>`;
        if (w > 36 && hh > 16) s += `<text x="4" y="12">${esc(common.fitText(common.nodeLabel(d.data), w - 8))}</text>`;
        if (w > 36 && hh > 32) s += `<text x="4" y="26" opacity="0.8">${fmt(d.value)}</text>`;
        s += '</g>\n';
    }
    s += '</svg>';
    writeFileSync(`${out}/treemap.svg`, s);
}

/* ---------- Sunburst (same layout as views/sunburst.js) ---------- */
{
    const RINGS = 3, size = 420, radius = size / 2, ring = (radius - 4) / (RINGS + 1);
    const h = d3.hierarchy(common.truncate(tree, RINGS, 60)).sum((d) => (d.children ? 0 : d.value)).sort((a, b) => b.value - a.value);
    d3.partition().size([2 * Math.PI, RINGS + 1])(h);
    const arc = d3.arc().startAngle((d) => d.x0).endAngle((d) => d.x1)
        .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
        .innerRadius((d) => d.y0 * ring).outerRadius((d) => d.y1 * ring - 1);
    const segs = h.descendants().filter((d) => d.depth > 0 && (d.x1 - d.x0) * d.y0 * ring > 1.5);
    let s = `<svg viewBox="${-radius} ${-radius} ${size} ${size}" role="img" aria-label="Example sunburst of www.example.com">\n`;
    for (const d of segs) {
        const owner = d.data.ref ?? d.data.otherOf;
        const cls = owner === tree ? 's-other' : common.colourClass(owner, classes);
        const path = arc(d).replace(/-?\d+\.\d+(e-?\d+)?/g, (m) => r1(+m));
        s += `<g class="arc ring-${d.depth} ${cls}"><path d="${path}"/>`;
        if (((d.y0 + d.y1) / 2) * ring * (d.x1 - d.x0) > 14) {
            const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI;
            const r = ((d.y0 + d.y1) / 2) * ring;
            s += `<text transform="rotate(${r1(angle - 90)}) translate(${r1(r)},0) rotate(${angle < 180 ? 0 : 180})" dy="0.32em" text-anchor="middle">${esc(common.fitText(common.nodeLabel(d.data), ring - 10))}</text>`;
        }
        s += '</g>\n';
    }
    s += `<circle class="sun-centre" r="${r1(ring - 3)}"/><text class="sun-centre-label"><tspan class="big" x="0" dy="-0.1em">${fmt(h.value)}</tspan><tspan class="small" x="0" dy="1.5em">${esc(common.fitText(tree.name, ring * 2 - 24))}</tspan></text>\n</svg>`;
    writeFileSync(`${out}/sunburst.svg`, s);
}

/* ---------- Statistics (same geometry as views/stats.js) ---------- */
function barPath(x, y, w, h, horizontal) {
    const r = Math.min(4, horizontal ? w : h, (horizontal ? h : w) / 2);
    if (horizontal) return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}
function hbar(data, width, aria) {
    const BAR = 18, labelWidth = Math.min(220, Math.round(width * 0.38)), valueWidth = 64, step = BAR + 10;
    const height = data.length * step + 4;
    const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value)]).range([0, width - labelWidth - valueWidth]);
    let s = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}"><line class="baseline" x1="${labelWidth}" x2="${labelWidth}" y1="0" y2="${height}"/>`;
    data.forEach((d, i) => {
        const w = r1(Math.max(1, x(d.value)));
        s += `<g transform="translate(0,${i * step + 4})"><text class="cat-label" x="${labelWidth - 8}" y="${BAR / 2}" dy="0.32em" text-anchor="end">${esc(d.label)}</text><path class="bar" d="${barPath(labelWidth, 0, w, BAR, true).replace(/\d+\.\d+/g, (m) => r1(+m))}"/><text class="value-label" x="${r1(labelWidth + w + 6)}" y="${BAR / 2}" dy="0.32em">${fmt(d.value)}</text></g>`;
    });
    return s + '</svg>';
}
function columns(data, width, aria, tickLabel = (s) => s, tickEvery = 1) {
    const margin = { top: 8, right: 8, bottom: 24, left: 52 }, height = 220;
    const x = d3.scaleBand().domain(data.map((d) => d.label)).range([margin.left, width - margin.right]).paddingInner(0.2).paddingOuter(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value)]).nice(4).range([height - margin.bottom, margin.top]);
    const bar = Math.min(24, x.bandwidth());
    let s = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(aria)}">`;
    for (const t of y.ticks(4).filter(Number.isInteger)) {
        s += `<g class="tick" transform="translate(0,${r1(y(t))})"><line class="${t === 0 ? 'baseline' : 'gridline'}" x1="${margin.left}" x2="${width - margin.right}"/><text x="${margin.left - 8}" dy="0.32em" text-anchor="end">${fmt(t)}</text></g>`;
    }
    data.forEach((d, i) => {
        if (d.value > 0) s += `<path class="bar" d="${barPath(r1(x(d.label) + (x.bandwidth() - bar) / 2), r1(y(d.value)), r1(bar), r1(Math.max(1, y(0) - y(d.value))), false).replace(/\d+\.\d{2,}/g, (m) => r1(+m))}"/>`;
        if (i % tickEvery === 0) s += `<text class="cat-label" x="${r1(x(d.label) + x.bandwidth() / 2)}" y="${height - 6}" text-anchor="middle">${esc(tickLabel(d.label))}</text>`;
    });
    return s + '</svg>';
}
writeFileSync(`${out}/sections.svg`, hbar(stats.sectionSeries, 400, 'Example bar chart: URLs in each top-level section'));
writeFileSync(`${out}/depth.svg`, columns(stats.depthSeries, 400, 'Example column chart: URLs at each path depth'));
writeFileSync(`${out}/months.svg`, columns(stats.monthSeries, 400, 'Example column chart: URLs by lastmod month', (s) => s.slice(2), Math.ceil(stats.monthSeries.length / 6)));
console.log(`Figures written to ${out}. Total ${stats.totalUrls} URLs, ${stats.withLastmod} with lastmod, ${stats.images} images, ${stats.videos} videos.`);
