// Follow sitemap index files to their sub-sitemaps, with hard limits.
// This module has no DOM or network code. The caller supplies `fetchText` and `parse`.

export const DEFAULT_LIMITS = Object.freeze({
    maxDepth: 3, // The protocol does not permit nested index files, but some sites use them.
    maxSitemaps: 500,
    maxUrls: 250000,
    concurrency: 3,
});

/** Hosts are "related" if they are equal without `www.`, or one is a subdomain of the other. */
export function relatedHosts(a, b) {
    const strip = (h) => h.toLowerCase().replace(/^www\./, '');
    a = strip(a);
    b = strip(b);
    return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
}

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

/**
 * @param {{url?: string, urls?: string[], text?: string, label?: string}} root  One or more URLs, or text the user supplied.
 * @param {object} options
 * @param {(url: string, o: {signal?: AbortSignal}) => Promise<{text: string, via: string, bytes: number}>} options.fetchText
 * @param {(text: string) => {type: string, entries: object[], invalid: number}} options.parse
 * @param {(hosts: string[]) => Promise<boolean>} [options.confirmCrossHost]
 * @param {(url: string) => Promise<boolean>} [options.checkRobots]  False if robots.txt denies the URL.
 * @param {(host: string) => Promise<boolean>} [options.confirmRobots]  Asked one time for denied files.
 * @param {(sitemaps: object[], urlCount: number) => void} [options.onProgress]
 */
export async function crawl(root, { fetchText, parse, limits = DEFAULT_LIMITS, signal, confirmCrossHost, checkRobots, confirmRobots, onProgress }) {
    const sitemaps = [];
    const urls = [];
    const seenSitemaps = new Set();
    const seenUrls = new Map();
    const queue = [];
    const notes = new Set();
    let duplicates = 0;
    let invalid = 0;
    let crossHostDecision = null;
    let robotsDecision = null;

    const rootUrls = root.urls ?? (root.url ? [root.url] : []);
    const rootHost = rootUrls.length > 0 ? hostOf(rootUrls[0]) : '';
    const progress = () => onProgress?.(sitemaps, urls.length);

    function enqueue(url, parent, depth) {
        if (seenSitemaps.has(url)) return;
        if (sitemaps.length >= limits.maxSitemaps) {
            notes.add('sitemap_limit');
            return;
        }
        seenSitemaps.add(url);
        const record = { id: sitemaps.length, url, parent, depth, status: 'queued', type: '', count: 0, via: '', bytes: 0, error: '' };
        sitemaps.push(record);
        queue.push(record);
    }

    function askCrossHost(host) {
        if (crossHostDecision === null) {
            crossHostDecision = confirmCrossHost ? confirmCrossHost(host) : Promise.resolve(true);
        }
        return crossHostDecision;
    }

    function askRobots(host) {
        if (robotsDecision === null) {
            robotsDecision = confirmRobots ? confirmRobots(host) : Promise.resolve(false);
        }
        return robotsDecision;
    }

    function handleParsed(record, parsed) {
        record.type = parsed.type;
        invalid += parsed.invalid ?? 0;
        if (parsed.type === 'index') {
            record.count = parsed.entries.length;
            if (record.depth + 1 > limits.maxDepth) {
                notes.add('depth_limit');
                return;
            }
            for (const entry of parsed.entries) enqueue(entry.loc, record.id, record.depth + 1);
            return;
        }
        for (const entry of parsed.entries) {
            const first = seenUrls.get(entry.loc);
            if (first) {
                duplicates++;
                // Keep the other files that list this URL, for the include/exclude filter.
                if (first.sitemap !== record.id && !first.also?.includes(record.id)) (first.also ??= []).push(record.id);
                continue;
            }
            if (urls.length >= limits.maxUrls) {
                notes.add('url_limit');
                break;
            }
            seenUrls.set(entry.loc, entry);
            entry.sitemap = record.id;
            urls.push(entry);
            record.count++;
        }
    }

    async function processRecord(record) {
        if (urls.length >= limits.maxUrls) {
            record.status = 'skipped';
            record.error = 'URL limit';
            return;
        }
        const host = hostOf(record.url);
        if (rootHost && record.depth > 0 && !relatedHosts(host, rootHost)) {
            if (!(await askCrossHost(host))) {
                record.status = 'skipped';
                record.error = 'Different host';
                return;
            }
        }
        if (checkRobots && !(await checkRobots(record.url))) {
            if (!(await askRobots(host))) {
                record.status = 'skipped';
                record.error = 'Denied by robots.txt';
                return;
            }
        }
        record.status = 'loading';
        progress();
        const result = await fetchText(record.url, { signal });
        record.via = result.via;
        record.bytes = result.bytes;
        handleParsed(record, parse(result.text));
        record.status = 'done';
    }

    async function worker() {
        while (queue.length > 0) {
            if (signal?.aborted) return;
            const record = queue.shift();
            try {
                await processRecord(record);
            } catch (error) {
                if (error?.name === 'AbortError') return;
                record.status = 'error';
                record.error = error?.message || 'Unknown error';
            }
            progress();
        }
    }

    if (rootUrls.length > 0) {
        for (const url of rootUrls) enqueue(url, null, 0);
    } else {
        const record = { id: 0, url: root.label || 'Supplied text', parent: null, depth: 0, status: 'done', type: '', count: 0, via: 'local', bytes: root.text.length, error: '' };
        sitemaps.push(record);
        handleParsed(record, parse(root.text)); // A parse error here goes to the caller.
        progress();
    }

    // Workers stop when the queue is empty. A worker that adds entries keeps the loop going,
    // thus we start new rounds until no work remains.
    while (queue.length > 0 && !signal?.aborted) {
        await Promise.all(Array.from({ length: limits.concurrency }, worker));
    }

    for (const record of sitemaps) {
        if (record.status === 'queued' || record.status === 'loading') record.status = 'cancelled';
    }

    return { sitemaps, urls, duplicates, invalid, notes: [...notes], aborted: Boolean(signal?.aborted) };
}
