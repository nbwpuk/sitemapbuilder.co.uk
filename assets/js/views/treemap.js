// Zoomable treemap. Area = number of URLs. Colour = top-level section.
import { el, clear, formatNumber } from '../safe.js';
import { d3, truncate, crumbs, legend, colourClass, nodeLabel, nodeTooltip, showTooltip, hideTooltip, focusPoint, fitText } from './common.js';

const HEADER = 20;

export function render(container, state) {
    const vs = (state.viewState.zoomable ??= { focus: state.root });
    const focus = vs.focus;

    const nav = crumbs(focus, (node) => {
        vs.focus = node;
        render(container, state);
    });
    const hint = el('span', { class: 'count', text: 'Select a group to zoom in.' });
    const canvas = el('div', { class: 'canvas' });
    clear(container).append(el('div', { class: 'view-toolbar' }, nav, el('span', { class: 'spacer' }), hint), canvas, legend(state.root, state.classes));

    const width = Math.max(320, canvas.clientWidth);
    const height = Math.max(420, Math.min(720, Math.round(innerHeight * 0.68)));

    // A group gets a header only if its share of the area is large enough to show one.
    const hasHeader = (d) => d.value / d.parent.value > 0.02;

    const hierarchy = d3.hierarchy(truncate(focus, 2)).sum((d) => (d.children ? 0 : d.value)).sort((a, b) => b.value - a.value);
    d3.treemap().size([width, height]).paddingOuter(2).paddingInner(2)
        .paddingTop((d) => (d.depth === 1 && d.children && hasHeader(d) ? HEADER : 2)).round(true)(hierarchy);
    const total = hierarchy.value;

    const svg = d3.select(canvas).append('svg').attr('viewBox', [0, 0, width, height]).attr('height', height)
        .attr('role', 'group').attr('aria-label', 'Treemap of URL counts');

    const zoomTo = (datum) => {
        const target = datum.self ? null : datum.ref;
        if (!target || target === focus || target.children.length === 0) return;
        vs.focus = target;
        hideTooltip();
        render(container, state);
    };

    // Group headers (depth 1 with children).
    const groups = hierarchy.children?.filter((d) => d.children) ?? [];
    const group = svg.append('g').selectAll('g').data(groups).join('g')
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
    group.append('rect').attr('class', 'group-bg').attr('rx', 3)
        .attr('width', (d) => d.x1 - d.x0).attr('height', (d) => d.y1 - d.y0)
        .on('click', (event, d) => zoomTo(d.data));
    group.filter(hasHeader).append('text').attr('class', 'group-label').attr('x', 5).attr('y', 14)
        .text((d) => fitText(`${nodeLabel(d.data)}  ${formatNumber(d.value)}`, d.x1 - d.x0 - 8, 7));

    // Cells: leaves of the truncated hierarchy. A click zooms to the depth-1 ancestor.
    const cell = svg.append('g').selectAll('g').data(hierarchy.leaves()).join('g')
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
        .attr('class', (d) => {
            const owner = d.data.ref ?? d.data.otherOf;
            const target = d.depth === 1 ? d.data : d.parent.data;
            const canZoom = !target.self && target.ref && target.ref !== focus && target.ref.children.length > 0;
            return `cell ${owner === state.root ? 's-other' : colourClass(owner, state.classes)} ${canZoom ? '' : 'leaf'}`;
        })
        .attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', (d) => `${nodeLabel(d.data)}, ${d.value} URLs`)
        .on('click', (event, d) => zoomTo(d.depth === 1 ? d.data : d.parent.data))
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                zoomTo(d.depth === 1 ? d.data : d.parent.data);
            }
        })
        .on('pointermove', (event, d) => showTooltip(event, nodeTooltip(d.data, total)))
        .on('pointerleave', hideTooltip)
        .on('focus', function (event, d) { showTooltip(focusPoint(this), nodeTooltip(d.data, total)); })
        .on('blur', hideTooltip);

    cell.append('rect').attr('rx', 2)
        .attr('width', (d) => Math.max(0, d.x1 - d.x0)).attr('height', (d) => Math.max(0, d.y1 - d.y0));

    // Labels only where the text fits in the cell.
    cell.filter((d) => d.x1 - d.x0 > 36 && d.y1 - d.y0 > 16).append('text').attr('x', 4).attr('y', 12)
        .text((d) => fitText(nodeLabel(d.data), d.x1 - d.x0 - 8));
    cell.filter((d) => d.x1 - d.x0 > 36 && d.y1 - d.y0 > 32).append('text').attr('x', 4).attr('y', 26).attr('opacity', 0.8)
        .text((d) => fitText(formatNumber(d.value), d.x1 - d.x0 - 8));

    return { svg: svg.node(), name: 'treemap' };
}
