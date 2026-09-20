// Download one sitemap file. Try the target directly; if the browser blocks that, use our proxy.
import { SitemapError } from './parser.js';

export const MAX_TRANSFER_BYTES = 15 * 1024 * 1024;
export const MAX_TEXT_BYTES = 52 * 1024 * 1024; // The sitemap protocol permits 50 MB uncompressed.

const PROXY_MESSAGES = {
    bad_url: 'The address is not valid.',
    blocked_host: 'We do not download from this address.',
    dns: 'We cannot find this host.',
    too_many_redirects: 'The server sent too many redirects.',
    too_large: 'The file is too large.',
    not_sitemap: 'The server did not send a sitemap.',
    upstream_status: 'The server sent an error status.',
    upstream_error: 'We cannot connect to the server.',
    rate_limited: 'Too many requests. Wait some minutes, then try again.',
    forbidden: 'Our server refused the request.',
    robots_denied: 'The robots.txt file of the site does not permit this download.',
};

/** Read a byte stream to the end. Stop with an error if it goes above `cap`. */
async function readCapped(stream, cap) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > cap) {
            await reader.cancel();
            throw new SitemapError('too_large', 'The file is too large.');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

/** Bytes -> text. Gzip data (magic 1f 8b) goes through a second size cap (gzip bomb protection). */
export async function bytesToText(bytes) {
    if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
        if (typeof DecompressionStream === 'undefined') {
            throw new SitemapError('gzip', 'Your browser cannot read gzip files.');
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        try {
            bytes = await readCapped(stream, MAX_TEXT_BYTES);
        } catch (error) {
            if (error instanceof SitemapError) throw error;
            throw new SitemapError('gzip', 'The gzip data is damaged.');
        }
    }
    if (bytes.length > MAX_TEXT_BYTES) throw new SitemapError('too_large', 'The file is too large.');
    return new TextDecoder('utf-8').decode(bytes);
}

async function readResponse(response) {
    if (!response.body) return new Uint8Array(await response.arrayBuffer());
    return readCapped(response.body, MAX_TRANSFER_BYTES);
}

async function fetchDirect(url, signal) {
    const response = await fetch(url, {
        signal,
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'follow',
    });
    if (!response.ok) {
        throw new SitemapError('upstream_status', `The server sent status ${response.status}.`);
    }
    return readResponse(response);
}

async function fetchViaProxy(url, signal) {
    const response = await fetch('/api/fetch.php?url=' + encodeURIComponent(url), {
        signal,
        credentials: 'omit',
        cache: 'no-store',
    });
    if (!response.ok) {
        let code = 'upstream_error';
        let status = 0;
        try {
            const body = await response.json();
            if (typeof body.error === 'string') code = body.error;
            if (Number.isInteger(body.status)) status = body.status;
        } catch {
            // Not JSON: keep the default code.
        }
        let message = PROXY_MESSAGES[code] ?? PROXY_MESSAGES.upstream_error;
        if (code === 'upstream_status' && status) message = `The server sent status ${status}.`;
        throw new SitemapError(code, message);
    }
    return readResponse(response);
}

/** The Sitemap: lines and the rules for our agent from the robots.txt file of `origin`. The proxy reads the file. */
export async function fetchRobotsData(origin, { signal } = {}) {
    const response = await fetch('/api/fetch.php?mode=robots&url=' + encodeURIComponent(origin + '/'), {
        signal,
        credentials: 'omit',
        cache: 'no-store',
    });
    if (!response.ok) throw new SitemapError('upstream_error', PROXY_MESSAGES.upstream_error);
    return response.json();
}

/** @returns {Promise<{text: string, via: 'direct'|'proxy', bytes: number}>} */
export async function fetchSitemap(url, { signal } = {}) {
    // An https page cannot load http content (mixed content), thus http targets go to the proxy.
    const canTryDirect = !(location.protocol === 'https:' && url.startsWith('http:'));
    if (canTryDirect) {
        try {
            const bytes = await fetchDirect(url, signal);
            return { text: await bytesToText(bytes), via: 'direct', bytes: bytes.length };
        } catch (error) {
            if (error.name === 'AbortError' || error instanceof SitemapError) throw error;
            // TypeError: CORS or network failure. The proxy is the fallback.
        }
    }
    const bytes = await fetchViaProxy(url, signal);
    return { text: await bytesToText(bytes), via: 'proxy', bytes: bytes.length };
}
