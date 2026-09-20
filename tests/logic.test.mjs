// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl, csvCell, toCsv } from '../assets/js/safe.js';
import { buildTree, buildStats, pathOf } from '../assets/js/model.js';
import { crawl, relatedHosts } from '../assets/js/crawler.js';

test('safeHttpUrl permits only http(s) without credentials', () => {
    assert.equal(safeHttpUrl(' https://example.com/a '), 'https://example.com/a');
    assert.equal(safeHttpUrl('javascript:alert(1)'), null);
    assert.equal(safeHttpUrl('data:text/html,<script>1</script>'), null);
    assert.equal(safeHttpUrl('file:///etc/passwd'), null);
    assert.equal(safeHttpUrl('https://user:pw@example.com/'), null);
    assert.equal(safeHttpUrl('https://example.com/' + 'a'.repeat(3000)), null);
    assert.equal(safeHttpUrl('not a url'), null);
});

test('csvCell stops formula injection and quotes correctly', () => {
    assert.equal(csvCell('=HYPERLINK("http://evil")'), '"\'=HYPERLINK(""http://evil"")"');
    assert.equal(csvCell('+1'), "'+1");
    assert.equal(csvCell('-1'), "'-1");
    assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell(null), '');
    assert.equal(toCsv(['a'], [['x'], ['=1']]), "a\r\nx\r\n'=1\r\n");
});

const E = (loc, extra = {}) => ({ loc, lastmod: '', changefreq: '', priority: '', images: 0, videos: 0, alternates: 0, ...extra });

test('buildTree makes a path hierarchy with counts', () => {
    const urls = [E('https://ex.com/'), E('https://ex.com/blog/'), E('https://ex.com/blog/a'), E('https://ex.com/blog/b?x=1'), E('https://ex.com/shop/item/1')];
    const root = buildTree(urls);
    assert.equal(root.name, 'ex.com');
    assert.equal(root.count, 5);
    assert.deepEqual(root.children.map((c) => [c.name, c.count]), [['blog', 3], ['shop', 1]]);
    const blog = root.children[0];
    assert.ok(blog.entry);
    assert.equal(blog.children.find((c) => c.name === 'b').children[0].name, '?x=1');
    const leaf = root.children[1].children[0].children[0];
    assert.equal(pathOf(leaf), 'ex.com/shop/item/1');
    assert.equal(leaf.section.name, 'shop');
    assert.equal(urls[0].depth, 0);
    assert.equal(urls[4].depth, 3);
});

test('buildTree uses a synthetic root for more than one host', () => {
    const root = buildTree([E('https://a.com/x'), E('https://b.com/y')]);
    assert.equal(root.name, 'All hosts');
    assert.equal(root.children.length, 2);
});

test('buildStats makes a continuous month series', () => {
    const urls = [E('https://ex.com/a', { lastmod: '2026-01-05' }), E('https://ex.com/b', { lastmod: '2026-03-01' })];
    const root = buildTree(urls);
    const stats = buildStats({ urls, sitemaps: [], duplicates: 0, invalid: 0 }, root);
    assert.deepEqual(stats.monthSeries.map((m) => m.value), [1, 0, 1]);
    assert.equal(stats.withLastmod, 2);
});

test('relatedHosts', () => {
    assert.ok(relatedHosts('www.ex.com', 'ex.com'));
    assert.ok(relatedHosts('blog.ex.com', 'www.ex.com'));
    assert.ok(!relatedHosts('ex.com', 'evil.com'));
    assert.ok(!relatedHosts('notex.com', 'ex.com'));
});

function fakeSite(files) {
    const calls = [];
    return {
        calls,
        fetchText: async (url) => {
            calls.push(url);
            if (!(url in files)) throw new Error('404');
            return { text: url, via: 'direct', bytes: 1 };
        },
        parse: (url) => ({ invalid: 0, ...files[url] }),
    };
}
const index = (...locs) => ({ type: 'index', entries: locs.map((loc) => ({ loc })) });
const urlset = (...locs) => ({ type: 'urlset', entries: locs.map((loc) => E(loc)) });

test('crawl follows an index, removes duplicates, and records failures', async () => {
    const site = fakeSite({
        'https://ex.com/sitemap.xml': index('https://ex.com/pages.xml', 'https://ex.com/posts.xml', 'https://ex.com/missing.xml'),
        'https://ex.com/pages.xml': urlset('https://ex.com/', 'https://ex.com/about'),
        'https://ex.com/posts.xml': urlset('https://ex.com/about', 'https://ex.com/p/1'),
    });
    const result = await crawl({ url: 'https://ex.com/sitemap.xml' }, site);
    assert.equal(result.urls.length, 3);
    assert.equal(result.duplicates, 1);
    assert.equal(result.sitemaps.length, 4);
    assert.equal(result.sitemaps.find((s) => s.url.endsWith('missing.xml')).status, 'error');
});

test('crawl survives a cycle and obeys the depth limit', async () => {
    const site = fakeSite({
        'https://ex.com/a.xml': index('https://ex.com/b.xml'),
        'https://ex.com/b.xml': index('https://ex.com/a.xml', 'https://ex.com/c.xml'),
        'https://ex.com/c.xml': index('https://ex.com/d.xml'),
        'https://ex.com/d.xml': index('https://ex.com/e.xml'),
        'https://ex.com/e.xml': urlset('https://ex.com/deep'),
    });
    const result = await crawl({ url: 'https://ex.com/a.xml' }, site);
    assert.deepEqual(site.calls, ['https://ex.com/a.xml', 'https://ex.com/b.xml', 'https://ex.com/c.xml', 'https://ex.com/d.xml']);
    assert.ok(result.notes.includes('depth_limit'));
    assert.equal(result.urls.length, 0);
});

test('crawl obeys the sitemap and URL limits', async () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://ex.com/s${i}.xml`);
    const files = { 'https://ex.com/i.xml': index(...many) };
    for (const [i, u] of many.entries()) files[u] = urlset(`https://ex.com/${i}/a`, `https://ex.com/${i}/b`);
    const site = fakeSite(files);
    const limits = { maxDepth: 3, maxSitemaps: 6, maxUrls: 7, concurrency: 3 };
    const result = await crawl({ url: 'https://ex.com/i.xml' }, { ...site, limits });
    assert.equal(result.sitemaps.length, 6);
    assert.equal(result.urls.length, 7);
    assert.ok(result.notes.includes('sitemap_limit'));
    assert.ok(result.notes.includes('url_limit'));
});

test('crawl asks one time before it downloads from a different host', async () => {
    const site = fakeSite({
        'https://ex.com/i.xml': index('https://evil.test/1.xml', 'https://evil.test/2.xml', 'https://cdn.ex.com/3.xml'),
        'https://cdn.ex.com/3.xml': urlset('https://ex.com/ok'),
    });
    let asked = 0;
    const result = await crawl({ url: 'https://ex.com/i.xml' }, { ...site, confirmCrossHost: async () => (asked++, false) });
    assert.equal(asked, 1);
    assert.ok(!site.calls.some((u) => u.includes('evil.test')));
    assert.equal(result.urls.length, 1);
    assert.equal(result.sitemaps.filter((s) => s.status === 'skipped').length, 2);
});

test('crawl stops on abort', async () => {
    const controller = new AbortController();
    const site = fakeSite({ 'https://ex.com/i.xml': index('https://ex.com/1.xml', 'https://ex.com/2.xml') });
    const fetchText = async (url, o) => {
        if (url.endsWith('i.xml')) return site.fetchText(url);
        controller.abort();
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    };
    const result = await crawl({ url: 'https://ex.com/i.xml' }, { ...site, fetchText, signal: controller.signal });
    assert.ok(result.aborted);
    assert.ok(result.sitemaps.some((s) => s.status === 'cancelled'));
});

test('crawl accepts supplied text as the root', async () => {
    const site = fakeSite({ 'https://ex.com/1.xml': urlset('https://ex.com/x') });
    const parse = (t) => (t === 'PASTED' ? index('https://ex.com/1.xml') : site.parse(t));
    const result = await crawl({ text: 'PASTED', label: 'Pasted XML' }, { ...site, parse });
    assert.equal(result.urls.length, 1);
});
