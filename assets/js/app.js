// Entry point: input forms, crawl control, progress, view tabs, exports.
import { el, clear, safeHttpUrl, sitemapUrlFromInput, formatNumber, formatBytes } from './safe.js';
import { parseSitemap } from './parser.js';
import { fetchSitemap, fetchRobotsData, bytesToText, MAX_TRANSFER_BYTES } from './fetcher.js';
import { createRobotsLookup, robotsAllows } from './robots.js';
import { crawl, DEFAULT_LIMITS } from './crawler.js';
import { buildTree, buildStats, filterUrls } from './model.js';
import { assignSectionColours, hideTooltip } from './views/common.js';
import { exportCsv, exportJson, exportSvg } from './export.js';
import * as tree from './views/tree.js';
import * as treemap from './views/treemap.js';
import * as sunburst from './views/sunburst.js';
import * as table from './views/table.js';
import * as stats from './views/stats.js';

const VIEWS = { tree, treemap, sunburst, table, stats };

const $ = (id) => document.getElementById(id);
const ui = {
    urlField: $('url-field'), pasteField: $('paste-field'), fileField: $('file-field'),
    progress: $('progress'), summary: $('progress-summary'), list: $('progress-list'), messages: $('messages'),
    details: $('progress-details'), cancel: $('cancel-btn'),
    results: $('results'), tiles: $('tiles'), view: $('view'),
    filter: $('sitemap-filter'), filterSummary: $('sitemap-filter-summary'), filterList: $('sitemap-filter-list'),
    exportSvg: $('export-svg'), dialog: $('confirm-dialog'), confirmText: $('confirm-text'),
};

let state = null; // { result, excluded, root, urls, sitemaps, stats, classes, viewState }
let controller = null;
let activeView = 'tree';
let rendered = null;
const lookupRobots = createRobotsLookup(fetchRobotsData);

/* ---------- Tabs ---------- */

function setupTabs(tablist, onSelect) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const select = (tab, focus = false) => {
        for (const t of tabs) {
            t.setAttribute('aria-selected', String(t === tab));
            t.tabIndex = t === tab ? 0 : -1;
        }
        if (focus) tab.focus();
        onSelect(tab);
    };
    for (const tab of tabs) tab.addEventListener('click', () => select(tab));
    tablist.addEventListener('keydown', (event) => {
        const i = tabs.indexOf(document.activeElement);
        if (i === -1) return;
        if (event.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length], true);
        else if (event.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
}

setupTabs(document.querySelector('[aria-label="Input method"]'), (tab) => {
    for (const id of ['in-url', 'in-paste', 'in-file']) $(id).hidden = id !== tab.getAttribute('aria-controls');
});

setupTabs(document.querySelector('[aria-label="View"]'), (tab) => {
    activeView = tab.dataset.view;
    ui.view.setAttribute('aria-labelledby', tab.id);
    renderView();
});

/* ---------- Progress ---------- */

function message(text, isError = false) {
    ui.messages.append(el('p', { class: isError ? 'message error' : 'message', text }));
}

const NOTE_TEXT = {
    sitemap_limit: `The index has more than ${formatNumber(DEFAULT_LIMITS.maxSitemaps)} sitemap files. We read only the first ${formatNumber(DEFAULT_LIMITS.maxSitemaps)}.`,
    url_limit: `The site has more than ${formatNumber(DEFAULT_LIMITS.maxUrls)} URLs. We stopped at the limit.`,
    depth_limit: 'Some index files are nested too deep. We did not follow them.',
};

let progressFrame = 0;
function showProgress(sitemaps, urlCount) {
    cancelAnimationFrame(progressFrame);
    progressFrame = requestAnimationFrame(() => {
        const done = sitemaps.filter((s) => s.status !== 'queued' && s.status !== 'loading').length;
        ui.summary.textContent = `${formatNumber(done)} of ${formatNumber(sitemaps.length)} sitemap files read. ${formatNumber(urlCount)} URLs found.`;
        const items = sitemaps.map((s) => el('li', {},
            el('span', { class: `status status-${s.status}`, text: s.status }),
            el('span', { class: 'url', title: s.url, text: s.url }),
            el('span', { class: 'meta', text: s.error || [s.type === 'index' ? `${formatNumber(s.count)} files` : s.type ? `${formatNumber(s.count)} URLs` : '', s.bytes ? formatBytes(s.bytes) : '', s.via].filter(Boolean).join(' · ') }),
        ));
        ui.list.replaceChildren(...items);
    });
}

/** Show the confirm dialog. The queue lets only one question be open at a time. */
let dialogQueue = Promise.resolve();
function confirmDialog(title, text, yes, no) {
    const answer = dialogQueue.then(() => new Promise((resolve) => {
        $('confirm-title').textContent = title;
        ui.confirmText.textContent = text;
        $('confirm-yes').textContent = yes;
        $('confirm-no').textContent = no;
        const finish = (value) => {
            ui.dialog.close();
            resolve(value);
        };
        $('confirm-yes').onclick = () => finish(true);
        $('confirm-no').onclick = () => finish(false);
        ui.dialog.oncancel = () => resolve(false);
        ui.dialog.showModal();
    }));
    dialogQueue = answer;
    return answer;
}

/** Ask the user one time before we download sitemap files from an unrelated host. */
function confirmCrossHost(host) {
    return confirmDialog('Sitemap on a different host',
        `The sitemap index points to files on "${host}", which is a different host. Do you want to download these files?`,
        'Download them', 'Skip these files');
}

/** Ask the user one time about files that robots.txt denies. Our server does not download them. */
function confirmRobots(host) {
    return confirmDialog('Denied by robots.txt',
        `The robots.txt file of "${host}" does not permit the download of one or more sitemap files. Our server will not download them. Do you want your browser to try a direct download?`,
        'Try a direct download', 'Skip these files');
}

/* ---------- Crawl ---------- */

async function run(rootSpec) {
    controller?.abort();
    controller = new AbortController();
    const mine = controller;

    hideTooltip();
    state = null;
    rendered = null;
    ui.results.hidden = true;
    ui.progress.hidden = false;
    ui.cancel.hidden = false;
    ui.details.open = true;
    clear(ui.messages);
    clear(ui.list);
    ui.summary.textContent = 'Start…';

    let result;
    let robotsNote = '';
    try {
        if (rootSpec.guessed) {
            // The user typed only a domain. The Sitemap: lines in robots.txt are better than a guess.
            ui.summary.textContent = 'Read robots.txt…';
            const robots = await lookupRobots(rootSpec.url, { signal: controller.signal });
            if (mine !== controller) return;
            if (robots.sitemaps.length > 0) {
                rootSpec = { urls: robots.sitemaps };
                robotsNote = `The robots.txt file lists ${formatNumber(robots.sitemaps.length)} sitemap ${robots.sitemaps.length === 1 ? 'file' : 'files'}.`;
                if (robots.sitemaps.length === 1) ui.urlField.value = robots.sitemaps[0];
            } else {
                robotsNote = `${robots.found ? 'The robots.txt file lists no sitemap' : 'We found no robots.txt file'}. We try ${rootSpec.url}.`;
                ui.urlField.value = rootSpec.url;
            }
        }
        result = await crawl(rootSpec, {
            fetchText: fetchSitemap,
            parse: parseSitemap,
            signal: controller.signal,
            confirmCrossHost,
            checkRobots: async (url) => robotsAllows((await lookupRobots(url, { signal: mine.signal })).rules, url),
            confirmRobots,
            onProgress: showProgress,
        });
    } catch (error) {
        if (mine !== controller) return;
        ui.cancel.hidden = true;
        if (error?.name === 'AbortError') {
            ui.summary.textContent = 'You cancelled the download.';
            return;
        }
        ui.summary.textContent = 'We cannot read this sitemap.';
        message(error?.message || 'Unknown error', true);
        return;
    }
    if (mine !== controller) return; // A newer run replaced this one.
    ui.cancel.hidden = true;
    showProgress(result.sitemaps, result.urls.length);

    if (robotsNote) message(robotsNote);
    for (const note of result.notes) message(NOTE_TEXT[note] ?? note);
    if (result.aborted) message('You cancelled the download. The views show the URLs that we found before that.');
    const failed = result.sitemaps.filter((s) => s.status === 'error');
    if (failed.length > 0) message(`${formatNumber(failed.length)} sitemap ${failed.length === 1 ? 'file' : 'files'} failed. See the list for the cause.`, true);
    if (result.invalid > 0) message(`We ignored ${formatNumber(result.invalid)} entries that are not valid http(s) URLs.`);

    if (result.urls.length === 0) {
        if (failed.length === 0 && !result.aborted) message('The sitemap contains no URLs.', true);
        return;
    }

    state = { result, excluded: new Set(), sitemaps: result.sitemaps };
    applyFilter();
    ui.details.open = failed.length > 0;
    ui.results.hidden = false;
    renderFilter();
    ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Sitemap filter ---------- */

/** Build the tree and the statistics again from the included sitemap files, then show them. */
function applyFilter() {
    const urls = filterUrls(state.result.urls, state.excluded);
    const root = buildTree(urls);
    Object.assign(state, {
        root,
        urls,
        stats: buildStats({ ...state.result, urls, excluded: state.excluded }, root),
        classes: assignSectionColours(root),
        viewState: {}, // The old view state points into the old tree.
    });
    renderTiles();
    renderView();
}

function renderFilter() {
    const files = state.sitemaps.filter((s) => s.type === 'urlset' && s.count > 0);
    ui.filter.hidden = files.length < 2;
    ui.filter.open = false;
    if (files.length < 2) return;

    const boxes = [];
    const summary = () => {
        ui.filterSummary.textContent = `Sitemap files in the views: ${formatNumber(files.length - state.excluded.size)} of ${formatNumber(files.length)}`;
    };
    const setAll = (checked) => {
        for (const box of boxes) box.checked = checked;
        state.excluded = new Set(checked ? [] : files.map((s) => s.id));
        summary();
        applyFilter();
    };
    const items = files.map((s) => {
        const box = el('input', { type: 'checkbox' });
        box.checked = true;
        box.addEventListener('change', () => {
            if (box.checked) state.excluded.delete(s.id);
            else state.excluded.add(s.id);
            summary();
            applyFilter();
        });
        boxes.push(box);
        return el('li', {}, el('label', {}, box, el('span', { class: 'url', title: s.url, text: s.url }), el('span', { class: 'meta', text: `${formatNumber(s.count)} URLs` })));
    });
    const all = el('button', { type: 'button', text: 'Include all' });
    const none = el('button', { type: 'button', text: 'Exclude all' });
    all.addEventListener('click', () => setAll(true));
    none.addEventListener('click', () => setAll(false));
    clear(ui.filterList).append(el('div', { class: 'filter-actions' }, all, none), el('ul', { class: 'progress-list filter-list' }, ...items));
    summary();
}

function renderTiles() {
    const s = state.stats;
    const tile = (label, value, note) => el('div', { class: 'tile' },
        el('div', { class: 'label', text: label }), el('div', { class: 'value', text: value }), note ? el('div', { class: 'note', text: note }) : null);
    const percent = s.totalUrls > 0 ? Math.floor((s.withLastmod / s.totalUrls) * 100) : 0;
    clear(ui.tiles).append(
        tile('URLs', formatNumber(s.totalUrls), s.duplicates > 0 ? `${formatNumber(s.duplicates)} ${s.duplicates === 1 ? 'duplicate' : 'duplicates'} removed` : 'No duplicates'),
        tile('Sitemap files', formatNumber(s.sitemapCount), [s.failedSitemaps > 0 ? `${formatNumber(s.failedSitemaps)} failed` : 'All read', s.excludedSitemaps > 0 ? `${formatNumber(s.excludedSitemaps)} excluded` : ''].filter(Boolean).join(' · ')),
        tile('Hosts', formatNumber(s.hostCount)),
        tile('Deepest path', formatNumber(s.maxDepth), 'levels below the home page'),
        tile('With lastmod', `${percent}%`, `${formatNumber(s.withLastmod)} URLs`),
        tile('Images / videos', `${formatNumber(s.images)} / ${formatNumber(s.videos)}`, s.alternates > 0 ? `${formatNumber(s.alternates)} hreflang links` : null),
    );
}

function renderView() {
    if (!state) return;
    hideTooltip();
    if (state.urls.length === 0) {
        rendered = null;
        clear(ui.view).append(el('p', { class: 'message', text: 'All sitemap files are excluded. Include one or more files to see the views.' }));
        ui.exportSvg.disabled = true;
        return;
    }
    rendered = VIEWS[activeView].render(ui.view, state);
    ui.exportSvg.disabled = !rendered?.svg;
}

/* ---------- Inputs ---------- */

$('in-url').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = sitemapUrlFromInput(ui.urlField.value);
    if (input === null) {
        ui.urlField.setCustomValidity('Enter a domain or a sitemap address, for example example.com/sitemap.xml.');
        ui.urlField.reportValidity();
        return;
    }
    if (!input.guessed) ui.urlField.value = input.url; // Show the address that we download.
    run(input);
});
ui.urlField.addEventListener('input', () => ui.urlField.setCustomValidity(''));

$('in-paste').addEventListener('submit', (event) => {
    event.preventDefault();
    run({ text: ui.pasteField.value, label: 'Pasted XML' });
});

$('in-file').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = ui.fileField.files[0];
    if (!file) return;
    ui.progress.hidden = false;
    clear(ui.messages);
    if (file.size > MAX_TRANSFER_BYTES * 4) {
        message('The file is too large.', true);
        return;
    }
    try {
        const text = await bytesToText(new Uint8Array(await file.arrayBuffer()));
        run({ text, label: file.name });
    } catch (error) {
        message(error?.message || 'We cannot read this file.', true);
    }
});

ui.cancel.addEventListener('click', () => controller?.abort());

/* ---------- Exports ---------- */

ui.exportSvg.addEventListener('click', () => state && rendered?.svg && exportSvg(state, rendered.svg, rendered.name, rendered.scene));
$('export-csv').addEventListener('click', () => state && exportCsv(state, activeView === 'table' ? table.currentRows(state) : state.urls));
$('export-json').addEventListener('click', () => state && exportJson(state));

/* ---------- Page ---------- */

let resizeTimer = 0;
let lastWidth = innerWidth;
addEventListener('resize', () => {
    if (innerWidth === lastWidth) return; // Mobile browsers fire resize when the address bar moves.
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderView, 200);
});

// A ?url= parameter only fills the field. A download starts only after a user action,
// thus a crafted link cannot make a visitor's browser start a crawl.
const preset = safeHttpUrl(new URLSearchParams(location.search).get('url') ?? '');
if (preset !== null) ui.urlField.value = preset;
