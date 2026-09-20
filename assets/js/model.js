// URL list -> path hierarchy and statistics. No DOM code.

function decodeSegment(segment) {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

/** Path segments of a URL. `/blog/` and `/blog` give the same result. A query becomes a last segment. */
export function segmentsOf(url) {
    const segments = url.pathname.split('/').filter((s) => s !== '').map(decodeSegment);
    if (url.search) segments.push(url.search);
    return segments;
}

/**
 * URLs that stay when the user excludes sitemap files. A URL stays if one or more of its files is included.
 * If the first file of a URL is excluded, the result has a copy that names the first included file.
 */
export function filterUrls(urls, excluded) {
    if (excluded.size === 0) return urls;
    const kept = [];
    for (const entry of urls) {
        if (!excluded.has(entry.sitemap)) {
            kept.push(entry);
            continue;
        }
        const other = entry.also?.find((id) => !excluded.has(id));
        if (other !== undefined) kept.push({ ...entry, sitemap: other });
    }
    return kept;
}

function makeNode(name, parent) {
    return { name, parent, childMap: new Map(), children: [], count: 0, entry: null, section: null, depth: parent ? parent.depth + 1 : 0 };
}

/**
 * Build the tree. Node fields:
 *   name, depth, children[] (largest first), count (pages in the subtree, this node included),
 *   entry (the sitemap entry if the node is a page itself), section (the top-level ancestor).
 * With one host, the host is the root. With more hosts, a synthetic root contains one node for each host.
 */
export function buildTree(urls) {
    const top = makeNode('All hosts', null);
    for (const entry of urls) {
        let url;
        try {
            url = new URL(entry.loc);
        } catch {
            continue;
        }
        entry.depth = 0;
        let node = top;
        for (const name of [url.host, ...segmentsOf(url)]) {
            let child = node.childMap.get(name);
            if (!child) {
                child = makeNode(name, node);
                node.childMap.set(name, child);
            }
            node = child;
            entry.depth++;
        }
        entry.depth--; // The host is not a path level.
        node.entry ??= entry;
    }

    const root = top.childMap.size === 1 ? top.childMap.values().next().value : top;
    root.parent = null;

    // Iterative post-order: count pages, sort children, release the maps.
    const stack = [[root, false]];
    while (stack.length > 0) {
        const [node, visited] = stack.pop();
        if (!visited) {
            stack.push([node, true]);
            for (const child of node.childMap.values()) stack.push([child, false]);
            continue;
        }
        node.children = [...node.childMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        node.childMap = null;
        node.count = (node.entry ? 1 : 0) + node.children.reduce((sum, child) => sum + child.count, 0);
    }

    // Depth relative to the real root, and the section (top-level branch) of each node.
    const walk = [[root, 0, null]];
    while (walk.length > 0) {
        const [node, depth, section] = walk.pop();
        node.depth = depth;
        node.section = section;
        for (const child of node.children) walk.push([child, depth + 1, section ?? child]);
    }
    return root;
}

/** Full path text of a node, for breadcrumbs and tooltips. */
export function pathOf(node) {
    const parts = [];
    for (let n = node; n; n = n.parent) parts.unshift(n.name);
    if (parts.length === 1) return parts[0];
    return parts[0] + '/' + parts.slice(1).join('/');
}

function tally(map, key) {
    map.set(key, (map.get(key) ?? 0) + 1);
}

export function buildStats(result, root) {
    const { urls, sitemaps, excluded } = result;
    const hosts = new Map();
    const depths = new Map();
    const months = new Map();
    const changefreq = new Map();
    const perSitemap = new Map();
    let withLastmod = 0;
    let images = 0;
    let videos = 0;
    let alternates = 0;

    for (const entry of urls) {
        try {
            tally(hosts, new URL(entry.loc).host);
        } catch {
            continue;
        }
        tally(depths, entry.depth ?? 0);
        tally(perSitemap, entry.sitemap);
        if (entry.lastmod) {
            withLastmod++;
            tally(months, entry.lastmod.slice(0, 7));
        }
        if (entry.changefreq) tally(changefreq, entry.changefreq);
        images += entry.images ?? 0;
        videos += entry.videos ?? 0;
        alternates += entry.alternates ?? 0;
    }

    const maxDepth = Math.max(0, ...depths.keys());
    const depthSeries = [];
    for (let d = 0; d <= maxDepth; d++) depthSeries.push({ label: String(d), value: depths.get(d) ?? 0 });

    // Continuous month axis. Keep the most recent 36 months.
    let monthSeries = [];
    let olderMonths = 0;
    if (months.size > 0) {
        const keys = [...months.keys()].sort();
        let [y, m] = keys[0].split('-').map(Number);
        const [endY, endM] = keys[keys.length - 1].split('-').map(Number);
        while ((y < endY || (y === endY && m <= endM)) && monthSeries.length < 2000) {
            const key = `${y}-${String(m).padStart(2, '0')}`;
            monthSeries.push({ label: key, value: months.get(key) ?? 0 });
            if (++m > 12) {
                m = 1;
                y++;
            }
        }
        if (monthSeries.length > 36) {
            const cut = monthSeries.slice(0, -36);
            olderMonths = cut.reduce((sum, item) => sum + item.value, 0);
            monthSeries = monthSeries.slice(-36);
        }
    }

    return {
        totalUrls: urls.length,
        sitemapCount: sitemaps.length,
        excludedSitemaps: excluded?.size ?? 0,
        failedSitemaps: sitemaps.filter((s) => s.status === 'error').length,
        hostCount: hosts.size,
        duplicates: result.duplicates,
        invalid: result.invalid,
        withLastmod,
        images,
        videos,
        alternates,
        maxDepth,
        depthSeries,
        monthSeries,
        olderMonths,
        changefreqSeries: [...changefreq].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
        sectionSeries: root.children.map((child) => ({ label: (root.name === 'All hosts' ? '' : '/') + child.name, value: child.count })),
        sitemapSeries: sitemaps
            .filter((s) => s.type === 'urlset' && !excluded?.has(s.id))
            .map((s) => ({ label: s.url, value: perSitemap.get(s.id) ?? 0 }))
            .sort((a, b) => b.value - a.value),
    };
}
