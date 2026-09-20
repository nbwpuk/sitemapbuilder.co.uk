// Statistics charts. Each chart has one series, thus one colour and no legend.
import { el, clear, formatNumber } from '../safe.js';
import { d3, showTooltip, hideTooltip, focusPoint, fitText } from './common.js';

const BAR = 18; // Maximum bar thickness is 24 px.

function dataTable(data, labelHead) {
    const table = el('table', {},
        el('thead', {}, el('tr', {}, el('th', { text: labelHead }), el('th', { class: 'num', text: 'URLs' }))),
        el('tbody', {}, data.map((d) => el('tr', {}, el('td', { text: d.label }), el('td', { class: 'num', text: formatNumber(d.value) })))),
    );
    return el('details', {}, el('summary', { text: 'Show the data as a table' }), table);
}

function chartBox(title, sub) {
    return el('section', { class: 'chart' }, el('h3', { text: title }), el('p', { class: 'sub', text: sub }));
}

function hover(selection, describe) {
    selection
        .attr('tabindex', 0).attr('role', 'img')
        .attr('aria-label', (d) => `${d.label}: ${d.value} URLs`)
        .on('pointermove', (event, d) => showTooltip(event, describe(d)))
        .on('pointerleave', hideTooltip)
        .on('focus', function (event, d) { showTooltip(focusPoint(this), describe(d)); })
        .on('blur', hideTooltip);
}

/** Path for a bar with a 4 px rounded data end and a square baseline end. */
function barPath(x, y, w, h, horizontal) {
    const r = Math.min(4, horizontal ? w : h, (horizontal ? h : w) / 2);
    if (horizontal) return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}

/** Horizontal bars for named categories. The value is at the tip of each bar. */
function hbarChart(box, data, width, labelHead, shortLabel = (s) => s) {
    if (data.length === 0) return box.append(el('p', { class: 'empty', text: 'No data.' }));
    const shown = data.slice(0, 12);
    const labelWidth = Math.min(220, Math.round(width * 0.38));
    const valueWidth = 64;
    const step = BAR + 10;
    const height = shown.length * step + 4;
    const x = d3.scaleLinear().domain([0, d3.max(shown, (d) => d.value) || 1]).range([0, width - labelWidth - valueWidth]);

    const svg = d3.select(box).append('svg').attr('viewBox', [0, 0, width, height]).attr('height', height);
    svg.append('line').attr('class', 'baseline').attr('x1', labelWidth).attr('x2', labelWidth).attr('y1', 0).attr('y2', height);
    const row = svg.selectAll('g').data(shown).join('g').attr('class', 'bar-group').attr('transform', (d, i) => `translate(0,${i * step + 4})`);
    row.append('rect').attr('class', 'bar-hit').attr('width', width).attr('height', step - 2).attr('y', -2);
    row.append('text').attr('class', 'cat-label').attr('x', labelWidth - 8).attr('y', BAR / 2).attr('dy', '0.32em').attr('text-anchor', 'end')
        .text((d) => fitText(shortLabel(d.label), labelWidth - 12));
    row.append('path').attr('class', 'bar').attr('d', (d) => barPath(labelWidth, 0, Math.max(1, x(d.value)), BAR, true));
    row.append('text').attr('class', 'value-label').attr('x', (d) => labelWidth + Math.max(1, x(d.value)) + 6).attr('y', BAR / 2).attr('dy', '0.32em')
        .text((d) => formatNumber(d.value));
    hover(row, (d) => ({ title: d.label, lines: [`${formatNumber(d.value)} URLs`] }));

    if (data.length > shown.length) box.append(el('p', { class: 'sub', text: `The chart shows the largest ${shown.length} of ${formatNumber(data.length)}. The table shows all.` }));
    box.append(dataTable(data, labelHead));
}

/** Columns for ordered categories (depth, month). Values are on the y axis and in the tooltip. */
function columnChart(box, data, width, labelHead, tickLabel = (s) => s, tickEvery = 1) {
    if (data.length === 0) return box.append(el('p', { class: 'empty', text: 'No data.' }));
    const margin = { top: 8, right: 8, bottom: 24, left: 52 };
    const height = 220;
    const x = d3.scaleBand().domain(data.map((d) => d.label)).range([margin.left, width - margin.right]).paddingInner(0.2).paddingOuter(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) || 1]).nice(4).range([height - margin.bottom, margin.top]);
    const bar = Math.min(24, x.bandwidth());

    const svg = d3.select(box).append('svg').attr('viewBox', [0, 0, width, height]).attr('height', height);
    const ticks = y.ticks(4).filter(Number.isInteger);
    const tick = svg.append('g').selectAll('g').data(ticks).join('g').attr('class', 'tick').attr('transform', (d) => `translate(0,${y(d)})`);
    tick.append('line').attr('class', (d) => (d === 0 ? 'baseline' : 'gridline')).attr('x1', margin.left).attr('x2', width - margin.right);
    tick.append('text').attr('x', margin.left - 8).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => formatNumber(d));

    const column = svg.append('g').selectAll('g').data(data).join('g').attr('class', 'bar-group');
    column.append('rect').attr('class', 'bar-hit').attr('x', (d) => x(d.label)).attr('width', x.bandwidth()).attr('y', margin.top).attr('height', height - margin.top - margin.bottom);
    column.filter((d) => d.value > 0).append('path').attr('class', 'bar')
        .attr('d', (d) => barPath(x(d.label) + (x.bandwidth() - bar) / 2, y(d.value), bar, Math.max(1, y(0) - y(d.value)), false));
    column.filter((d, i) => i % tickEvery === 0).append('text').attr('class', 'cat-label')
        .attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', height - 6).attr('text-anchor', 'middle').text((d) => tickLabel(d.label));
    hover(column, (d) => ({ title: `${labelHead} ${d.label}`, lines: [`${formatNumber(d.value)} URLs`] }));

    box.append(dataTable(data, labelHead));
}

export function render(container, state) {
    const stats = state.stats;
    const grid = el('div', { class: 'charts' });
    clear(container).append(grid);
    const columns = container.clientWidth >= 900 ? 2 : 1;
    const width = Math.max(300, Math.floor((container.clientWidth - (columns - 1) * 24) / columns));

    const sections = chartBox('Largest sections', 'Number of URLs below each top-level path.');
    const sitemaps = chartBox('URLs for each sitemap file', 'Number of unique URLs that each file supplied.');
    const depth = chartBox('Path depth', 'Number of URLs at each depth. Depth 0 is the home page.');
    const months = chartBox('Last modified, by month',
        stats.withLastmod === 0 ? 'The sitemap has no lastmod values.'
            : `${formatNumber(stats.withLastmod)} of ${formatNumber(stats.totalUrls)} URLs have a lastmod value.`
              + (stats.olderMonths > 0 ? ` ${formatNumber(stats.olderMonths)} older URLs are not in the chart.` : ''));
    grid.append(sections, sitemaps, depth, months);

    hbarChart(sections, stats.sectionSeries, width, 'Section');
    hbarChart(sitemaps, stats.sitemapSeries, width, 'Sitemap', (label) => {
        try {
            return new URL(label).pathname.split('/').pop() || label;
        } catch {
            return label;
        }
    });
    columnChart(depth, stats.depthSeries, width, 'Depth', (s) => s, Math.ceil(stats.depthSeries.length / 16));
    columnChart(months, stats.monthSeries, width, 'Month', (s) => s.slice(2), Math.ceil(stats.monthSeries.length / 6));

    return { svg: null, name: 'stats' };
}
