// Sitemap text -> { type: 'index' | 'urlset', entries: [...] }
import { safeHttpUrl } from './safe.js';

export class SitemapError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'SitemapError';
        this.code = code;
    }
}

const NS_IMAGE = 'http://www.google.com/schemas/sitemap-image/1.1';
const NS_VIDEO = 'http://www.google.com/schemas/sitemap-video/1.1';
const NS_XHTML = 'http://www.w3.org/1999/xhtml';

function childText(parent, name) {
    for (const child of parent.children) {
        if (child.localName === name) return child.textContent.trim();
    }
    return '';
}

/** lastmod is W3C datetime. Keep it only if it starts with a plausible date. */
function cleanLastmod(value) {
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 1990 || year > 2100 || month < 1 || month > 12) return '';
    return value.slice(0, 35);
}

const CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

function parseTextSitemap(text) {
    const entries = [];
    let invalid = 0;
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === '') continue;
        const loc = safeHttpUrl(line);
        if (loc === null) invalid++;
        else entries.push({ loc, lastmod: '', changefreq: '', priority: '', images: 0, videos: 0, alternates: 0 });
    }
    if (entries.length === 0) throw new SitemapError('not_sitemap', 'This is not a sitemap.');
    return { type: 'urlset', entries, invalid };
}

export function parseSitemap(text) {
    if (typeof text !== 'string' || text.trim() === '') {
        throw new SitemapError('empty', 'The file is empty.');
    }
    text = text.replace(/^﻿/, '');

    const firstTag = text.search(/<[A-Za-z]/);
    if (firstTag === -1) return parseTextSitemap(text);

    // A DOCTYPE can declare entities that expand to a very large size ("billion laughs").
    // A sitemap never needs a DOCTYPE, thus we refuse it. It can only occur before the root element.
    if (/<!DOCTYPE|<!ENTITY/i.test(text.slice(0, firstTag))) {
        throw new SitemapError('doctype', 'The file contains a DOCTYPE. For safety, we do not read it.');
    }

    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new SitemapError('xml', 'The XML is not well-formed.');
    }
    const root = doc.documentElement;
    const entries = [];
    let invalid = 0;

    if (root.localName === 'sitemapindex') {
        for (const node of root.children) {
            if (node.localName !== 'sitemap') continue;
            const loc = safeHttpUrl(childText(node, 'loc'));
            if (loc === null) invalid++;
            else entries.push({ loc, lastmod: cleanLastmod(childText(node, 'lastmod')) });
        }
        return { type: 'index', entries, invalid };
    }

    if (root.localName === 'urlset') {
        for (const node of root.children) {
            if (node.localName !== 'url') continue;
            const loc = safeHttpUrl(childText(node, 'loc'));
            if (loc === null) {
                invalid++;
                continue;
            }
            let images = 0;
            let videos = 0;
            let alternates = 0;
            for (const child of node.children) {
                if (child.namespaceURI === NS_IMAGE && child.localName === 'image') images++;
                else if (child.namespaceURI === NS_VIDEO && child.localName === 'video') videos++;
                else if (child.namespaceURI === NS_XHTML && child.localName === 'link') alternates++;
            }
            const changefreq = childText(node, 'changefreq').toLowerCase();
            const priority = Number.parseFloat(childText(node, 'priority'));
            entries.push({
                loc,
                lastmod: cleanLastmod(childText(node, 'lastmod')),
                changefreq: CHANGEFREQ.has(changefreq) ? changefreq : '',
                priority: priority >= 0 && priority <= 1 ? String(priority) : '',
                images,
                videos,
                alternates,
            });
        }
        return { type: 'urlset', entries, invalid };
    }

    throw new SitemapError('not_sitemap', 'This is XML, but it is not a sitemap.');
}
