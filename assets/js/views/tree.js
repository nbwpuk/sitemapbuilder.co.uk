// Collapsible tree with pan and zoom.
import { el, clear, safeLink, formatNumber } from '../safe.js';
import { pathOf } from '../model.js';
import { d3, fitText } from './common.js';

const PAGE = 200; // Children shown for each node before a "more" node.
const ROW = 20;
const COLUMN = 230;
const OPEN_DEPTH = 2;

/** View-model node. `open` and `shown` are the only state. */
function wrap(node, parent) {
    return { node, parent, open: false, shown: PAGE, kids: null };
}

function kidsOf(v) {
    v.kids ??= v.node.children.map((child) => wrap(child, v));
    return v.kids;
}

function visibleChildren(v) {
    if (!v.open) return null;
    const kids = kidsOf(v);
    const list = kids.slice(0, v.shown);
    if (kids.length > v.shown) list.push({ more: true, parent: v, remaining: kids.length - v.shown });
    return list;
}

function openToDepth(v, depth) {
    v.open = depth > 0 && v.node.children.length > 0;
    if (v.open) for (const kid of kidsOf(v).slice(0, v.shown)) openToDepth(kid, depth - 1);
    else if (v.kids) for (const kid of v.kids) openToDepth(kid, 0);
}

export function render(container, state) {
    const top = (state.viewState.tree ??= (() => {
        const v = wrap(state.root, null);
        openToDepth(v, OPEN_DEPTH);
        return { v, depth: OPEN_DEPTH, selected: null, transform: null };
    })());

    const details = el('div', { class: 'details-bar', role: 'status' });
    const count = el('span', { class: 'count' });
    const toolbar = el('div', { class: 'view-toolbar' },
        el('button', { type: 'button', text: 'Open one more level', onclick: () => setDepth(top.depth + 1) }),
        el('button', { type: 'button', text: 'Close one level', onclick: () => setDepth(Math.max(0, top.depth - 1)) }),
        el('button', { type: 'button', text: 'Reset position', onclick: () => resetView() }),
        el('span', { class: 'spacer' }),
        count,
    );
    const canvas = el('div', { class: 'canvas' });
    clear(container).append(toolbar, details, canvas);

    const width = Math.max(320, canvas.clientWidth);
    const height = Math.max(420, Math.min(760, Math.round(innerHeight * 0.7)));
    const svg = d3.select(canvas).append('svg')
        .attr('viewBox', [0, 0, width, height]).attr('height', height)
        .attr('class', 'pannable').attr('role', 'group').attr('aria-label', 'Site tree');
    const scene = svg.append('g');
    const linkLayer = scene.append('g');
    const nodeLayer = scene.append('g');

    const zoom = d3.zoom().scaleExtent([0.15, 3]).on('zoom', (event) => {
        top.transform = event.transform;
        scene.attr('transform', event.transform);
    });
    svg.call(zoom).on('dblclick.zoom', null);

    // Put the tree in view: root near the left edge, vertical centre on the middle of the open nodes.
    let extent = [0, 0];
    const home = () => {
        const span = extent[1] - extent[0] + 2 * ROW;
        const k = Math.max(0.35, Math.min(1, height / span));
        return d3.zoomIdentity.translate(200, height / 2 - ((extent[0] + extent[1]) / 2) * k).scale(k);
    };
    function resetView() {
        svg.call(zoom.transform, home());
    }

    function setDepth(depth) {
        top.depth = Math.min(depth, 12);
        openToDepth(top.v, top.depth);
        draw();
    }

    function select(v) {
        top.selected = v;
        clear(details);
        if (!v || v.more) return;
        const node = v.node;
        details.append(
            node.entry ? safeLink(node.entry.loc) : el('span', { text: pathOf(node) + ' (not a page in the sitemap)' }),
            ` - ${formatNumber(node.count)} ${node.count === 1 ? 'URL' : 'URLs'} in this branch`,
            node.entry?.lastmod ? ` - last modified ${node.entry.lastmod.slice(0, 10)}` : '',
        );
    }

    function activate(v) {
        if (v.more) {
            v.parent.shown += PAGE;
        } else if (v.node.children.length > 0) {
            v.open = !v.open;
        }
        if (!v.more) select(v);
        draw();
    }

    function draw() {
        const hierarchy = d3.hierarchy(top.v, visibleChildren);
        d3.tree().nodeSize([ROW, COLUMN])(hierarchy);
        const nodes = hierarchy.descendants();
        extent = d3.extent(nodes, (d) => d.x);
        count.textContent = `${formatNumber(nodes.length)} nodes shown`;

        const link = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);
        linkLayer.selectAll('path').data(hierarchy.links()).join('path').attr('class', 'tree-link').attr('d', link);

        const key = (d) => (d.data.more ? 'more:' : '') + pathOf((d.data.more ? d.data.parent : d.data).node);
        const groups = nodeLayer.selectAll('g').data(nodes, key).join((enter) => {
            const g = enter.append('g').attr('tabindex', 0).attr('role', 'button');
            g.append('circle').attr('r', 5);
            g.append('text').attr('dy', '0.32em');
            return g;
        });

        groups
            .attr('transform', (d) => `translate(${d.y},${d.x})`)
            .attr('class', (d) => {
                const v = d.data;
                if (v.more) return 'tree-node more';
                const hasKids = v.node.children.length > 0;
                return ['tree-node', hasKids ? (v.open ? 'open' : 'closed') : 'leaf', v.node.entry ? 'page' : '', v === top.selected ? 'selected' : ''].join(' ');
            })
            .attr('aria-expanded', (d) => (d.data.more || d.data.node.children.length === 0 ? null : String(d.data.open)))
            .attr('aria-label', (d) => (d.data.more
                ? `Show more: ${d.data.remaining} hidden`
                : `${d.data.node.name}, ${d.data.node.count} URLs`))
            .on('click', (event, d) => activate(d.data))
            .on('keydown', (event, d) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate(d.data);
                }
            })
            .on('focus', (event, d) => !d.data.more && !top.selected && select(d.data));

        groups.select('text').each(function (d) {
            const left = !d.data.more && d.data.open;
            const text = d3.select(this).attr('x', left ? -10 : 10).attr('text-anchor', left ? 'end' : 'start');
            text.selectAll('*').remove();
            if (d.data.more) {
                text.text(`Show ${formatNumber(Math.min(PAGE, d.data.remaining))} more (${formatNumber(d.data.remaining)} hidden)`);
                return;
            }
            const node = d.data.node;
            text.text(fitText(node.name, COLUMN - 70) || node.name.slice(0, 3));
            if (node.children.length > 0) text.append('tspan').attr('class', 'n').attr('dx', 6).text(formatNumber(node.count));
        });
    }

    draw();
    svg.call(zoom.transform, top.transform ?? home());
    if (top.selected) select(top.selected);

    return { svg: svg.node(), name: 'tree', scene: scene.node() };
}
