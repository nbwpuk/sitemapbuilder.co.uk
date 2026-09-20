// Zoomable sunburst. Angle = number of URLs. Three rings below the focus node.
import { el, clear, formatNumber } from '../safe.js';
import { d3, truncate, crumbs, legend, colourClass, nodeLabel, nodeTooltip, showTooltip, hideTooltip, focusPoint, fitText } from './common.js';

const RINGS = 3;

export function render(container, state) {
    const vs = (state.viewState.zoomable ??= { focus: state.root });
    const focus = vs.focus;
    const go = (node) => {
        if (!node) return;
        vs.focus = node;
        hideTooltip();
        render(container, state);
    };

    const hint = el('span', { class: 'count', text: 'Select a segment to zoom in. Select the centre to go up.' });
    const canvas = el('div', { class: 'canvas' });
    clear(container).append(el('div', { class: 'view-toolbar' }, crumbs(focus, go), el('span', { class: 'spacer' }), hint), canvas, legend(state.root, state.classes));

    const size = Math.max(320, Math.min(canvas.clientWidth, Math.round(innerHeight * 0.75), 760));
    const radius = size / 2;
    const ring = (radius - 4) / (RINGS + 1);

    const hierarchy = d3.hierarchy(truncate(focus, RINGS, 60)).sum((d) => (d.children ? 0 : d.value)).sort((a, b) => b.value - a.value);
    d3.partition().size([2 * Math.PI, RINGS + 1])(hierarchy);
    const total = hierarchy.value;

    const arc = d3.arc()
        .startAngle((d) => d.x0).endAngle((d) => d.x1)
        .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
        .innerRadius((d) => d.y0 * ring).outerRadius((d) => d.y1 * ring - 1);

    const svg = d3.select(canvas).append('svg').attr('viewBox', [-radius, -radius, size, size]).attr('height', size)
        .attr('role', 'group').attr('aria-label', 'Sunburst of URL counts');

    // Segments too thin to see or select are left out. Their area stays empty in the parent ring.
    const segments = hierarchy.descendants().filter((d) => d.depth > 0 && (d.x1 - d.x0) * d.y0 * ring > 1.5);

    const zoomTarget = (d) => (d.data.self || !d.data.ref || d.data.ref.children.length === 0 ? null : d.data.ref);

    const group = svg.append('g').selectAll('g').data(segments).join('g')
        .attr('class', (d) => {
            const owner = d.data.ref ?? d.data.otherOf;
            return `arc ring-${d.depth} ${owner === state.root ? 's-other' : colourClass(owner, state.classes)} ${zoomTarget(d) ? '' : 'leaf'}`;
        })
        .attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', (d) => `${nodeLabel(d.data)}, ${d.value} URLs`)
        .on('click', (event, d) => go(zoomTarget(d)))
        .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                go(zoomTarget(d));
            }
        })
        .on('pointermove', (event, d) => showTooltip(event, nodeTooltip(d.data, total)))
        .on('pointerleave', hideTooltip)
        .on('focus', function (event, d) { showTooltip(focusPoint(this), nodeTooltip(d.data, total)); })
        .on('blur', hideTooltip);

    group.append('path').attr('d', arc);

    // Radial labels, only where the arc is long enough for one line of text.
    group.filter((d) => ((d.y0 + d.y1) / 2) * ring * (d.x1 - d.x0) > 14).append('text')
        .attr('transform', (d) => {
            const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI;
            const r = ((d.y0 + d.y1) / 2) * ring;
            return `rotate(${angle - 90}) translate(${r},0) rotate(${angle < 180 ? 0 : 180})`;
        })
        .attr('dy', '0.32em').attr('text-anchor', 'middle')
        .text((d) => fitText(nodeLabel(d.data), ring - 10));

    svg.append('circle').attr('class', 'sun-centre').attr('r', ring - 3)
        .attr('tabindex', focus.parent ? 0 : null).attr('role', focus.parent ? 'button' : null)
        .attr('aria-label', focus.parent ? `Go up to ${focus.parent.name}` : null)
        .on('click', () => go(focus.parent))
        .on('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                go(focus.parent);
            }
        });
    const label = svg.append('text').attr('class', 'sun-centre-label');
    label.append('tspan').attr('class', 'big').attr('x', 0).attr('dy', '-0.1em').text(formatNumber(total));
    label.append('tspan').attr('class', 'small').attr('x', 0).attr('dy', '1.5em').text(fitText(focus.name, ring * 2 - 24));

    return { svg: svg.node(), name: 'sunburst' };
}
