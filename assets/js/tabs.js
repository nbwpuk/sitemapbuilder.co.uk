// Tab lists (the WAI-ARIA tabs pattern): click, arrow keys, and aria-selected.
// The caller shows and hides the panels in `onSelect`. The function returns `select(tab, focus)`.

export function setupTabs(tablist, onSelect) {
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
    return select;
}
