/**
 * Tab 1 — Lung Volumes & Capacities.
 * Interactive spirogram (textbook adult) with volume bands and capacity brackets,
 * a "measurable by spirometry" toggle, and a disease comparison using the simulator's model.
 */
import { store } from '../state.js';
import { buildMechanics } from '../core/model.js';
import { presetById, settingsFromPreset } from '../core/presets.js';
import { $, $$, fmt } from '../ui/dom.js';

// Textbook young adult (L)
const V = { RV: 1.3, ERV: 1.2, TV: 0.5, IRV: 3.0 };
const TLC = V.RV + V.ERV + V.TV + V.IRV;
const FRC = V.RV + V.ERV;

const ITEMS = {
  TV: { name: 'Tidal volume', kind: 'volume', value: V.TV, spiro: true, color: '#38bdf8',
    def: 'Volume inspired or expired with each normal quiet breath.',
    note: 'About 7 mL/kg ideal body weight. Measured during quiet breathing on the spirometer.' },
  IRV: { name: 'Inspiratory reserve volume', kind: 'volume', value: V.IRV, spiro: true, color: '#818cf8',
    def: 'Extra volume that can be inspired from end-tidal inspiration up to TLC.',
    note: 'Falls when tidal volume rises (exercise) or when TLC is reduced (restriction).' },
  ERV: { name: 'Expiratory reserve volume', kind: 'volume', value: V.ERV, spiro: true, color: '#34d399',
    def: 'Extra volume that can be expired from end-tidal expiration (FRC) down to RV.',
    note: 'Characteristically reduced in obesity because FRC falls toward RV.' },
  RV: { name: 'Residual volume', kind: 'volume', value: V.RV, spiro: false, color: '#94a3b8',
    def: 'Gas remaining in the lungs after a maximal expiration.',
    note: 'Cannot be exhaled, so spirometry cannot measure it. Rises with gas trapping (COPD, asthma) and with age.' },
  IC: { name: 'Inspiratory capacity', kind: 'capacity', parts: ['TV', 'IRV'], spiro: true,
    def: 'IC = TV + IRV: maximal volume inspired from FRC.',
    note: 'A falling IC/TLC ratio reflects hyperinflation in COPD.' },
  FRC: { name: 'Functional residual capacity', kind: 'capacity', parts: ['ERV', 'RV'], spiro: false,
    def: 'FRC = ERV + RV: volume at the end of a quiet expiration, where lung and chest-wall recoil balance.',
    note: 'Contains RV, so it needs body plethysmography, nitrogen washout or helium dilution.' },
  VC: { name: 'Vital capacity (FVC / SVC)', kind: 'capacity', parts: ['IRV', 'TV', 'ERV'], spiro: true,
    def: 'VC = IRV + TV + ERV: maximal volume exhaled after a maximal inspiration. FVC when exhaled forcefully, SVC when slowly.',
    note: 'A low FVC suggests restriction but is not diagnostic: confirm with TLC.' },
  TLC: { name: 'Total lung capacity', kind: 'capacity', parts: ['IRV', 'TV', 'ERV', 'RV'], spiro: false,
    def: 'TLC = VC + RV: gas in the lungs after a maximal inspiration.',
    note: 'The gold-standard definition of restriction is TLC < LLN. Needs plethysmography or gas dilution.' },
};
const VOLUME_ORDER = ['RV', 'ERV', 'TV', 'IRV']; // bottom → top

let root;
let selected = 'VC';
let showMeasurable = false;

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="mb-5">
    <h2 class="h2">Lung Volumes &amp; Capacities</h2>
    <p class="lead">Four non-overlapping <b>volumes</b> add up to the <b>capacities</b>. Click any volume or capacity to explore it. Toggle the overlay to see which ones a spirometer can measure.</p>
  </div>
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
    <div class="card card-pad lg:col-span-8">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input id="vol-measurable" type="checkbox" /> Show what spirometry can measure
        </label>
        <span class="ml-auto text-xs text-slate-500">Textbook young adult · TLC ≈ ${TLC.toFixed(1)} L</span>
      </div>
      <div class="overflow-x-auto"><svg id="vol-svg" viewBox="0 0 820 400" class="w-full min-w-[640px]" role="img" aria-label="Spirogram of lung volumes and capacities"></svg></div>
      <div class="mt-3 flex flex-wrap gap-1.5" id="vol-chips"></div>
    </div>
    <div class="space-y-4 lg:col-span-4">
      <div class="card card-pad" id="vol-info"></div>
      <div class="card card-pad">
        <h3 class="card-title mb-2">Measured by</h3>
        <table class="tbl text-xs">
          <thead><tr><th>Method</th><th>Measures</th></tr></thead>
          <tbody>
            <tr><td class="font-medium">Spirometry</td><td>TV, IRV, ERV, IC, VC (FVC/SVC), FEV₁, flows</td></tr>
            <tr><td class="font-medium">Body plethysmography</td><td>FRC (thoracic gas volume) → RV, TLC; includes trapped gas</td></tr>
            <tr><td class="font-medium">Gas dilution / N₂ washout</td><td>FRC (communicating gas only) → RV, TLC</td></tr>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-slate-500">Plethysmography exceeds dilution methods in severe obstruction because poorly ventilated, trapped gas is still compressed.</p>
      </div>
    </div>
  </div>

  <div class="card card-pad mt-5">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="h3">How disease changes the volumes</h3>
      <p class="text-xs text-slate-500">Illustrative, for the Simulator's current Subject (<span id="vol-subject"></span>)</p>
    </div>
    <div id="vol-compare" class="space-y-3"></div>
    <p class="callout-info mt-4 text-xs">Obstruction: gas trapping raises RV and RV/TLC, and emphysema raises TLC (hyperinflation), so VC falls even though the lungs are large. Restriction: TLC falls; in parenchymal disease RV falls roughly in proportion; in chest-wall/neuromuscular disease RV may be preserved. Spirometry sees only the VC segment.</p>
  </div>`;

  $('#vol-chips', el).innerHTML = Object.entries(ITEMS)
    .map(([k, it]) => `<button class="chip" data-item="${k}">${k} <span class="font-normal opacity-70">${it.kind}</span></button>`)
    .join('');
  $('#vol-chips', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]');
    if (b) select(b.dataset.item);
  });
  $('#vol-measurable', el).addEventListener('change', (e) => {
    showMeasurable = e.target.checked;
    draw();
  });
  $('#vol-svg', el).addEventListener('click', (e) => {
    const g = e.target.closest('[data-item]');
    if (g) select(g.dataset.item);
  });
  store.on('subject', renderCompare);
  draw();
  renderInfo();
  renderCompare();
}

export function onShow() {
  renderCompare();
}

function select(k) {
  selected = k;
  draw();
  renderInfo();
}

function draw() {
  const W = 820;
  const H = 400;
  const top = 20;
  const bottom = 370;
  const left = 50;
  const traceRight = 520;
  const y = (v) => bottom - ((bottom - top) * v) / TLC;
  const parts = new Set(ITEMS[selected].kind === 'volume' ? [selected] : ITEMS[selected].parts);

  // Volume bands
  let base = 0;
  let bands = '';
  for (const k of VOLUME_ORDER) {
    const it = ITEMS[k];
    const y1 = y(base + it.value);
    const y2 = y(base);
    const active = parts.has(k);
    const hatch = showMeasurable && !it.spiro;
    bands += `<g data-item="${k}" class="cursor-pointer">
      <rect x="${left}" y="${y1}" width="${traceRight - left}" height="${y2 - y1}" fill="${it.color}" fill-opacity="${active ? 0.32 : 0.1}" />
      ${hatch ? `<rect x="${left}" y="${y1}" width="${traceRight - left}" height="${y2 - y1}" fill="url(#hatch)" />` : ''}
      <text x="${left + 8}" y="${(y1 + y2) / 2 + 4}" font-size="13" font-weight="600" fill="#334155">${k}</text>
      <text x="${traceRight - 8}" y="${(y1 + y2) / 2 + 4}" text-anchor="end" font-size="11" fill="#64748b">${it.value.toFixed(1)} L</text>
    </g>`;
    base += it.value;
  }

  // Spirogram trace: quiet breathing → maximal inspiration → maximal expiration → quiet breathing
  const pts = [];
  const tidal = (x0, x1) => {
    for (let x = x0; x <= x1; x += 2) {
      const ph = ((x - x0) / 60) * 2 * Math.PI;
      pts.push([x, y(FRC + (V.TV * (1 - Math.cos(ph))) / 2)]);
    }
  };
  tidal(left, left + 180);
  const smooth = (x0, x1, v0, v1) => {
    for (let x = x0; x <= x1; x += 2) {
      const f = (1 - Math.cos(((x - x0) / (x1 - x0)) * Math.PI)) / 2;
      pts.push([x, y(v0 + (v1 - v0) * f)]);
    }
  };
  smooth(left + 182, left + 240, FRC, TLC);
  smooth(left + 242, left + 340, TLC, V.RV);
  smooth(left + 342, left + 400, V.RV, FRC);
  tidal(left + 402, traceRight - 4);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  // Capacity brackets on the right
  const caps = [
    { k: 'IC', from: FRC, to: TLC, x: 560 },
    { k: 'FRC', from: 0, to: FRC, x: 560 },
    { k: 'VC', from: V.RV, to: TLC, x: 650 },
    { k: 'TLC', from: 0, to: TLC, x: 740 },
  ];
  const brackets = caps.map(({ k, from, to, x }) => {
    const it = ITEMS[k];
    const active = selected === k;
    const hatch = showMeasurable && !it.spiro;
    const color = active ? '#4f46e5' : hatch ? '#cbd5e1' : '#64748b';
    const y1 = y(to) + 3;
    const y2 = y(from) - 3;
    const val = it.parts.reduce((s, p) => s + ITEMS[p].value, 0);
    return `<g data-item="${k}" class="cursor-pointer">
      <rect x="${x - 6}" y="${y1}" width="70" height="${y2 - y1}" fill="transparent" />
      <path d="M${x} ${y1} h8 V${y2} h-8" fill="none" stroke="${color}" stroke-width="${active ? 3 : 2}" />
      <text x="${x + 14}" y="${(y1 + y2) / 2}" font-size="14" font-weight="700" fill="${color}">${k}</text>
      <text x="${x + 14}" y="${(y1 + y2) / 2 + 15}" font-size="11" fill="${color}">${val.toFixed(1)} L</text>
      ${showMeasurable ? `<text x="${x + 14}" y="${(y1 + y2) / 2 + 30}" font-size="11" font-weight="700" fill="${it.spiro ? '#059669' : '#e11d48'}">${it.spiro ? '✓ spiro' : '✗ body box'}</text>` : ''}
    </g>`;
  });

  $('#vol-svg', root).innerHTML = `
    <defs>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#e11d48" stroke-width="2" stroke-opacity="0.45" />
      </pattern>
    </defs>
    <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#94a3b8" />
    <line x1="${left}" y1="${bottom}" x2="${traceRight}" y2="${bottom}" stroke="#94a3b8" />
    ${[0, 1, 2, 3, 4, 5, 6].map((v) => `<text x="${left - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#64748b">${v}</text>`).join('')}
    <text x="14" y="${(top + bottom) / 2}" font-size="11" fill="#64748b" transform="rotate(-90 14 ${(top + bottom) / 2})" text-anchor="middle">Volume (L)</text>
    <text x="${(left + traceRight) / 2}" y="${H - 6}" font-size="11" fill="#64748b" text-anchor="middle">Time →</text>
    ${bands}
    <path d="${path}" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linejoin="round" />
    ${showMeasurable ? `<text x="${left + 250}" y="${y(V.RV / 2) + 4}" font-size="11" font-weight="700" fill="#e11d48">cannot be exhaled</text>` : ''}
    ${brackets.join('')}
    <text x="${W - 10}" y="${H - 6}" font-size="10" fill="#94a3b8" text-anchor="end">Capacities = sums of volumes</text>`;

  $$('#vol-chips .chip', root).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.item === selected)));
}

function renderInfo() {
  const it = ITEMS[selected];
  const value = it.kind === 'volume' ? it.value : it.parts.reduce((s, p) => s + ITEMS[p].value, 0);
  $('#vol-info', root).innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-2xl font-bold text-indigo-700">${selected}</p>
        <p class="text-sm font-semibold text-slate-800">${it.name}</p>
      </div>
      <span class="${it.spiro ? 'tag-ok' : 'tag-bad'}">${it.spiro ? 'Spirometry ✓' : 'Not by spirometry'}</span>
    </div>
    <p class="mt-3 text-sm text-slate-700">${it.def}</p>
    <p class="mt-2 text-sm text-slate-600">${it.note}</p>
    <p class="mt-3 text-xs text-slate-500">Textbook value: <b class="font-mono">${value.toFixed(1)} L</b>${it.kind === 'capacity' ? ` = ${it.parts.join(' + ')}` : ''}</p>`;
}

function renderCompare() {
  if (!root) return;
  const subject = store.state.subject;
  $('#vol-subject', root).textContent = `${subject.age} y, ${subject.sex}, ${subject.heightCm} cm`;
  const rows = ['normal', 'copd', 'asthma', 'ipf', 'chestwall'].map((id) => {
    const m = buildMechanics(subject, settingsFromPreset(id));
    return { id, label: presetById(id).label, tlc: m.tlc, rv: m.rv, vc: m.vc };
  });
  const max = Math.max(...rows.map((r) => r.tlc));
  const pred = rows[0].tlc;
  $('#vol-compare', root).innerHTML = rows
    .map((r) => {
      const w = (r.tlc / max) * 100;
      return `<div class="grid grid-cols-12 items-center gap-2 text-xs">
        <div class="col-span-12 font-medium text-slate-700 sm:col-span-3">${r.label}</div>
        <div class="col-span-9 sm:col-span-7"><div class="flex h-6 overflow-hidden rounded" style="width:${w}%">
          <div class="flex items-center justify-center bg-indigo-400 text-[10px] font-semibold text-white" style="width:${(r.vc / r.tlc) * 100}%">VC ${fmt(r.vc, 1)}</div>
          <div class="flex items-center justify-center bg-slate-400 text-[10px] font-semibold text-white" style="width:${(r.rv / r.tlc) * 100}%">RV ${fmt(r.rv, 1)}</div>
        </div></div>
        <div class="col-span-3 text-right font-mono sm:col-span-2">TLC ${fmt(r.tlc, 1)} L <span class="text-slate-400">(${Math.round((r.tlc / pred) * 100)}%)</span></div>
      </div>`;
    })
    .join('');
}
