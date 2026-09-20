// Virtual table: only the rows in view are in the DOM, thus 250,000 URLs stay usable.
import { el, clear, safeLink, formatNumber } from '../safe.js';

const ROW = 28;
const OVERSCAN = 10;

const COLUMNS = [
    { key: 'loc', label: 'URL', get: (e) => e.loc },
    { key: 'lastmod', label: 'Last modified', get: (e) => e.lastmod },
    { key: 'changefreq', label: 'Change freq.', get: (e) => e.changefreq },
    { key: 'priority', label: 'Priority', get: (e) => (e.priority === '' ? -1 : Number(e.priority)), num: true },
    { key: 'depth', label: 'Depth', get: (e) => e.depth ?? 0, num: true },
    { key: 'sitemap', label: 'Sitemap', get: (e) => e.sitemap ?? 0 },
];

function shortSitemapName(url) {
    try {
        return new URL(url).pathname.split('/').pop() || url;
    } catch {
        return url;
    }
}

/** Rows that match the filters, in sort order. `export.js` uses the same list for CSV. */
export function currentRows(state) {
    const vs = state.viewState.table;
    return vs?.rows ?? state.urls;
}

export function render(container, state) {
    const vs = (state.viewState.table ??= { text: '', sitemap: '', sortKey: '', sortDir: 1, rows: state.urls, scroll: 0 });

    const search = el('input', { type: 'search', placeholder: 'Filter URLs (text)', 'aria-label': 'Filter URLs', maxlength: 200 });
    search.value = vs.text;
    const select = el('select', { 'aria-label': 'Filter by sitemap' }, el('option', { value: '', text: 'All sitemaps' }));
    for (const s of state.sitemaps) {
        if (s.type === 'urlset' && !state.excluded.has(s.id)) select.append(el('option', { value: String(s.id), text: `${shortSitemapName(s.url)} (${formatNumber(s.count)})` }));
    }
    select.value = vs.sitemap;
    const count = el('span', { class: 'count', role: 'status' });

    const head = el('div', { class: 'vt-head', role: 'row' });
    const headButtons = COLUMNS.map((column) => {
        const button = el('button', { type: 'button', onclick: () => sortBy(column.key) });
        head.append(el('div', { role: 'columnheader' }, button));
        return button;
    });
    const spacer = el('div', { class: 'vt-spacer' });
    const body = el('div', { class: 'vt-body', role: 'rowgroup', tabindex: 0, 'aria-label': 'URL rows' }, spacer);
    const table = el('div', { class: 'vt', role: 'table', 'aria-label': 'URLs in the sitemap' },
        el('div', { class: 'vt-scroll-x' }, el('div', { class: 'vt-inner' }, el('div', { role: 'rowgroup' }, head), body)));

    clear(container).append(el('div', { class: 'table-tools' }, search, select, count), table);

    function applyFilters() {
        const text = vs.text.trim().toLowerCase();
        const sitemap = vs.sitemap === '' ? null : Number(vs.sitemap);
        let rows = state.urls;
        if (text !== '' || sitemap !== null) {
            rows = rows.filter((e) => (sitemap === null || e.sitemap === sitemap) && (text === '' || e.loc.toLowerCase().includes(text)));
        }
        if (vs.sortKey !== '') {
            const get = COLUMNS.find((c) => c.key === vs.sortKey).get;
            const dir = vs.sortDir;
            rows = [...rows].sort((a, b) => {
                const x = get(a);
                const y = get(b);
                return (x < y ? -1 : x > y ? 1 : 0) * dir;
            });
        }
        vs.rows = rows;
        count.textContent = `${formatNumber(rows.length)} of ${formatNumber(state.urls.length)} URLs`;
        table.setAttribute('aria-rowcount', String(rows.length));
        spacer.style.height = `${rows.length * ROW}px`;
        COLUMNS.forEach((column, i) => {
            const active = column.key === vs.sortKey;
            headButtons[i].textContent = column.label + (active ? (vs.sortDir === 1 ? ' ▲' : ' ▼') : '');
            headButtons[i].parentElement.setAttribute('aria-sort', active ? (vs.sortDir === 1 ? 'ascending' : 'descending') : 'none');
        });
        drawRows();
    }

    function sortBy(key) {
        if (vs.sortKey === key) {
            if (vs.sortDir === 1) vs.sortDir = -1;
            else {
                vs.sortKey = '';
                vs.sortDir = 1;
            }
        } else {
            vs.sortKey = key;
            vs.sortDir = 1;
        }
        applyFilters();
    }

    function drawRows() {
        const rows = vs.rows;
        const first = Math.max(0, Math.floor(body.scrollTop / ROW) - OVERSCAN);
        const last = Math.min(rows.length, Math.ceil((body.scrollTop + body.clientHeight) / ROW) + OVERSCAN);
        const fragment = document.createDocumentFragment();
        for (let i = first; i < last; i++) {
            const e = rows[i];
            const sitemap = state.sitemaps[e.sitemap];
            const row = el('div', { class: 'vt-row', role: 'row', 'aria-rowindex': i + 1 },
                el('div', { class: 'loc', role: 'cell', title: e.loc }, safeLink(e.loc)),
                el('div', { role: 'cell', text: e.lastmod.replace('T', ' ').slice(0, 16) }),
                el('div', { role: 'cell', text: e.changefreq }),
                el('div', { class: 'num', role: 'cell', text: e.priority }),
                el('div', { class: 'num', role: 'cell', text: String(e.depth ?? '') }),
                el('div', { role: 'cell', title: sitemap?.url ?? '', text: sitemap ? shortSitemapName(sitemap.url) : '' }),
            );
            row.style.top = `${i * ROW}px`;
            fragment.append(row);
        }
        spacer.replaceChildren(fragment);
        if (rows.length === 0) spacer.append(el('div', { class: 'vt-empty', text: 'No URLs match the filters.' }));
    }

    let frame = 0;
    body.addEventListener('scroll', () => {
        vs.scroll = body.scrollTop;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(drawRows);
    });
    let timer = 0;
    search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            vs.text = search.value;
            body.scrollTop = 0;
            applyFilters();
        }, 150);
    });
    select.addEventListener('change', () => {
        vs.sitemap = select.value;
        body.scrollTop = 0;
        applyFilters();
    });

    applyFilters();
    body.scrollTop = vs.scroll;

    return { svg: null, name: 'table' };
}
