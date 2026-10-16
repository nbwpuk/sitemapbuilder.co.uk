// Help page: two levels of tabs. The address hash names the open panel, thus a link can open one section.
// Without JavaScript, all panels show one below the other.
import { setupTabs } from './tabs.js';

const $ = (id) => document.getElementById(id);

/** Make a tab list show only the panel of the selected tab. Returns `open(panelId)`. */
function panelTabs(tablist, onOpen) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const select = setupTabs(tablist, (tab) => {
        for (const t of tabs) $(t.getAttribute('aria-controls')).hidden = t !== tab;
        onOpen(tab.getAttribute('aria-controls'));
    });
    select(tabs[0]);
    return (panelId) => {
        const tab = tabs.find((t) => t.getAttribute('aria-controls') === panelId);
        if (tab) select(tab);
        return tab !== undefined;
    };
}

// Only a user action changes the hash. The first selection and a hash change are silent.
let silent = true;
const setHash = (id) => {
    if (!silent) history.replaceState(null, '', '#' + id);
};

const openView = panelTabs(document.querySelector('[aria-label="Views"]'), setHash);
const openSection = panelTabs(document.querySelector('[aria-label="Help sections"]'), (id) => {
    // The views panel has its own tabs: the hash names the open view.
    if (id === 'views') id = document.querySelector('[aria-label="Views"] [aria-selected="true"]').getAttribute('aria-controls');
    setHash(id);
});

function openFromHash() {
    const id = location.hash.slice(1);
    silent = true;
    if (openView(id)) openSection('views');
    else if (id !== '') openSection(id);
    silent = false;
}

openFromHash();
addEventListener('hashchange', openFromHash);
