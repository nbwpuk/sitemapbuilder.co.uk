// Helpers for untrusted data. Sitemap content is hostile input.
// Rule: untrusted strings go to the DOM only as text, never as markup.

const MAX_URL_LENGTH = 2048;

/** Return a normalised http(s) URL string, or null if the value is not safe. */
export function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.length > MAX_URL_LENGTH) return null;
    let url;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username !== '' || url.password !== '') return null;
    if (url.href.length > MAX_URL_LENGTH) return null;
    return url.href;
}

/**
 * Create an element. `props` sets known-safe properties only.
 * Children are nodes or strings. Strings become text nodes.
 */
export function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else if (key === 'href') throw new Error('Use safeLink() for links');
        else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
        if (child === undefined || child === null || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

/** Link to an untrusted URL. If the URL is not http(s), the result is plain text. */
export function safeLink(value, text) {
    const href = safeHttpUrl(value);
    const label = text ?? value;
    if (href === null) return el('span', { text: label });
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    a.textContent = label;
    return a;
}

export function clear(node) {
    node.replaceChildren();
    return node;
}

/**
 * One CSV cell. Spreadsheet programs run cells that start with = + - @ TAB or CR as formulas.
 * A leading apostrophe makes such a cell plain text.
 */
export function csvCell(value) {
    let text = value === undefined || value === null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    if (/[",\r\n]/.test(text)) text = '"' + text.replaceAll('"', '""') + '"';
    return text;
}

export function toCsv(header, rows) {
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) lines.push(row.map(csvCell).join(','));
    return lines.join('\r\n') + '\r\n';
}

export const formatNumber = (n) => Number(n).toLocaleString('en-GB');

export function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
