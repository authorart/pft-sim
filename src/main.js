/**
 * PFT Simulator — entry point: tab navigation and lazy mounting of each section.
 * © 2026 Sirot Jantharaksa, MD. All rights reserved.
 */
import './styles.css';
import { $ } from './ui/dom.js';
import * as volumes from './tabs/volumes.js';
import * as basics from './tabs/basics.js';
import * as technique from './tabs/technique.js';
import * as simulator from './tabs/simulator.js';
import * as trainer from './tabs/trainer.js';
import * as report from './tabs/report.js';

const TABS = [
  { id: 'volumes', label: '1 · Lung Volumes', mod: volumes },
  { id: 'basics', label: '2 · Clinical Basics', mod: basics },
  { id: 'technique', label: '3 · Technique & QC', mod: technique },
  { id: 'simulator', label: '4 · Simulator', mod: simulator },
  { id: 'trainer', label: '5 · Interpretation', mod: trainer },
  { id: 'report', label: '6 · Report', mod: report },
];

const nav = $('#tabs');
const app = $('#app');
const mounted = new Map();

nav.innerHTML = TABS.map(
  (t) => `<button class="tab-btn" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" data-tab="${t.id}">${t.label}</button>`,
).join('');

for (const t of TABS) {
  const panel = document.createElement('section');
  panel.id = `panel-${t.id}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${t.id}`);
  panel.hidden = true;
  app.appendChild(panel);
}

function show(id) {
  const tab = TABS.find((t) => t.id === id) ?? TABS[3];
  for (const t of TABS) {
    const active = t.id === tab.id;
    $(`#panel-${t.id}`).hidden = !active;
    $(`#tab-${t.id}`).setAttribute('aria-selected', String(active));
  }
  const panel = $(`#panel-${tab.id}`);
  if (!mounted.has(tab.id)) {
    tab.mod.mount(panel);
    mounted.set(tab.id, true);
  }
  tab.mod.onShow?.();
  if (location.hash !== `#${tab.id}`) history.replaceState(null, '', `#${tab.id}`);
}

nav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) {
    show(btn.dataset.tab);
    window.scrollTo({ top: 0 });
  }
});
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
document.addEventListener('pft:navigate', (e) => show(e.detail));

show(location.hash.slice(1) || 'volumes');
