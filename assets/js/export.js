// File downloads. All data stays in the browser.
import { toCsv } from './safe.js';

function download(name, type, text) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function fileStem(state) {
    const host = state.root.name.replace(/[^a-z0-9.-]+/gi, '_').slice(0, 60) || 'sitemap';
    return `sitemap-${host}`;
}

export function exportCsv(state, rows) {
    const header = ['url', 'lastmod', 'changefreq', 'priority', 'depth', 'images', 'videos', 'alternates', 'sitemap'];
    const lines = rows.map((e) => [e.loc, e.lastmod, e.changefreq, e.priority, e.depth ?? '', e.images, e.videos, e.alternates, state.sitemaps[e.sitemap]?.url ?? '']);
    download(`${fileStem(state)}.csv`, 'text/csv;charset=utf-8', '﻿' + toCsv(header, lines));
}

export function exportJson(state) {
    const toPlain = (node) => ({
        name: node.name,
        count: node.count,
        ...(node.entry ? { url: node.entry.loc, lastmod: node.entry.lastmod || undefined } : {}),
        ...(node.children.length > 0 ? { children: node.children.map(toPlain) } : {}),
    });
    const data = {
        generator: 'sitemapbuilder.co.uk',
        sitemaps: state.sitemaps.map(({ url, type, status, count, error }) => ({ url, type, status, count, error: error || undefined })),
        tree: toPlain(state.root),
    };
    download(`${fileStem(state)}.json`, 'application/json', JSON.stringify(data, null, 1));
}

const SVG_STYLE = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'paint-order'];
const EXPORT_PADDING = 24;

/**
 * The page styles the SVG with a stylesheet. A saved file has no stylesheet,
 * thus we copy the computed values to attributes on a clone.
 *
 * `scene` is the group that the view pans and zooms (the tree). If it is given, the file
 * shows the full content at scale 1, not only the part that is in view on the screen.
 */
export function exportSvg(state, svg, name, scene = null) {
    const clone = svg.cloneNode(true);
    const source = [svg, ...svg.querySelectorAll('*')];
    const target = [clone, ...clone.querySelectorAll('*')];
    source.forEach((node, i) => {
        const computed = getComputedStyle(node);
        const parent = i > 0 && node.parentElement ? getComputedStyle(node.parentElement) : null;
        for (const property of SVG_STYLE) {
            const value = computed.getPropertyValue(property);
            if (!value) continue;
            // A value that is the same as the parent value adds nothing (it is inherited, or it is the default).
            // Opacity is not inherited, thus only the default value 1 is left out.
            const redundant = property === 'opacity' ? value === '1' : parent?.getPropertyValue(property) === value;
            if (!redundant) target[i].setAttribute(property, value);
        }
        for (const attribute of ['class', 'tabindex', 'role', 'aria-label', 'aria-expanded']) target[i].removeAttribute(attribute);
    });

    let [x, y, w, h] = svg.getAttribute('viewBox').split(/[ ,]+/).map(Number);
    if (scene) {
        const box = scene.getBBox(); // In the coordinates of the scene, without the pan and zoom transform.
        target[source.indexOf(scene)].removeAttribute('transform');
        x = Math.floor(box.x - EXPORT_PADDING);
        y = Math.floor(box.y - EXPORT_PADDING);
        w = Math.ceil(box.width + 2 * EXPORT_PADDING);
        h = Math.ceil(box.height + 2 * EXPORT_PADDING);
        clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    }

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const background = getComputedStyle(document.body).getPropertyValue('--surface-1').trim() || '#fff';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, fill: background })) rect.setAttribute(k, v);
    clone.prepend(rect);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    download(`${fileStem(state)}-${name}.svg`, 'image/svg+xml', new XMLSerializer().serializeToString(clone));
}
