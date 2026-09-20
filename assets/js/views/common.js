// Helpers that the views share: tooltip, section colours, breadcrumbs, truncated hierarchies.
import { el, clear, formatNumber } from '../safe.js';
import { pathOf } from '../model.js';

export const d3 = globalThis.d3;

const MAX_SERIES = 8;

/**
 * Give each top-level section a colour class. The order is fixed at load time (largest first),
 * thus a section keeps its colour in each view. Sections after the eighth go to "Other".
 */
export function assignSectionColours(root) {
    const classes = new Map();
    const multi = root.children.length > MAX_SERIES;
    root.children.forEach((child, i) => {
        const named = multi ? i < MAX_SERIES - 1 : i < MAX_SERIES;
        classes.set(child, named ? `s${i + 1}` : 's-other');
    });
    return classes;
}

export function colourClass(node, classes) {
    return classes.get(node.section ?? node) ?? 's1';
}

export function legend(root, classes) {
    const box = el('div', { class: 'legend' });
    let other = 0;
    for (const child of root.children) {
        const cls = classes.get(child);
        if (cls === 's-other') {
            other++;
            continue;
        }
        box.append(el('span', { class: `key ${cls}` }, el('span', { class: 'swatch' }), child.name));
    }
    if (other > 0) box.append(el('span', { class: 'key s-other' }, el('span', { class: 'swatch' }), `Other (${formatNumber(other)} sections)`));
    return box;
}

/**
 * Copy `node` to a plain object for d3.hierarchy, `levels` deep.
 * Below that depth a branch becomes one leaf with the size of its subtree.
 * Only the largest `maxChildren` children stay; the remainder becomes one "other" leaf.
 */
export function truncate(node, levels, maxChildren = 120) {
    if (levels === 0 || node.children.length === 0) {
        return { ref: node, value: node.count };
    }
    const kept = node.children.slice(0, maxChildren);
    const children = kept.map((child) => truncate(child, levels - 1, maxChildren));
    const rest = node.children.slice(maxChildren);
    if (rest.length > 0) {
        children.push({ ref: null, otherOf: node, otherCount: rest.length, value: rest.reduce((sum, c) => sum + c.count, 0) });
    }
    if (node.entry) children.push({ ref: node, self: true, value: 1 });
    return { ref: node, children };
}

export function nodeLabel(datum) {
    if (datum.self) return '(this page)';
    if (datum.ref) return datum.ref.name;
    return `${formatNumber(datum.otherCount)} more`;
}

export function nodeTooltip(datum, total) {
    const lines = [];
    if (datum.ref) {
        lines.push(pathOf(datum.ref));
        if (datum.self) lines.push('The page itself');
    } else {
        lines.push(`${formatNumber(datum.otherCount)} smaller branches of ${pathOf(datum.otherOf)}`);
    }
    const share = total > 0 ? ` (${((datum.value / total) * 100).toFixed(1)}% of this view)` : '';
    return { title: nodeLabel(datum), lines: [...lines, `${formatNumber(datum.value)} ${datum.value === 1 ? 'URL' : 'URLs'}${share}`] };
}

export function crumbs(focus, onSelect) {
    const chain = [];
    for (let n = focus; n; n = n.parent) chain.unshift(n);
    const nav = el('nav', { class: 'crumbs', 'aria-label': 'Position in the site' });
    chain.forEach((node, i) => {
        if (i > 0) nav.append(el('span', { class: 'sep', text: '/' }));
        if (i === chain.length - 1) nav.append(el('span', { class: 'here', text: node.name }));
        else nav.append(el('button', { type: 'button', text: node.name, onclick: () => onSelect(node) }));
    });
    return nav;
}

// One tooltip element for the page. Position goes through the CSSOM, which the CSP permits.
const tip = () => document.getElementById('tooltip');

export function showTooltip(event, { title, lines = [] }) {
    const box = tip();
    clear(box).append(el('div', { class: 't-title', text: title }), ...lines.map((line) => el('div', { class: 't-line', text: line })));
    box.hidden = false;
    const pad = 14;
    const rect = box.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + rect.width > innerWidth - 8) x = Math.max(8, event.clientX - rect.width - pad);
    if (y + rect.height > innerHeight - 8) y = Math.max(8, event.clientY - rect.height - pad);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
}

export function hideTooltip() {
    tip().hidden = true;
}

/** Tooltip for keyboard focus: place it at the element. */
export function focusPoint(element) {
    const rect = element.getBoundingClientRect();
    return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
}

/** Shorten text to a pixel width. 6.4 px for each character is a safe estimate at 12 px. */
export function fitText(text, width, charWidth = 6.4) {
    const max = Math.floor(width / charWidth);
    if (max < 3) return '';
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
}
