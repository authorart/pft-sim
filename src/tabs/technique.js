/**
 * Tab 3 — Execution method & quality control (ATS/ERS 2019).
 * Three-phase technique, back-extrapolation, acceptability/usability, grading and an error gallery
 * generated live by the simulator model.
 */
import { store } from '../state.js';
import { buildMechanics, simulateManoeuvre } from '../core/model.js';
import { measure } from '../core/measure.js';
import { judgeTrial, GRADE_TEXT } from '../core/qc.js';
import { settingsFromPreset } from '../core/presets.js';
import { createFvChart, createVtChart, setData, line, curvePoints, COLORS } from '../ui/charts.js';
import { $, fmt, statusTag } from '../ui/dom.js';

let root;
const charts = [];

const GALLERY = [
  { id: 'good', title: 'Good manoeuvre', opt: {}, text: 'Sharp, early peak; smooth descent; plateau; full inspiratory loop closes the curve.' },
  { id: 'slow', title: 'Slow start / hesitation', opt: { slowStart: true }, text: 'Rounded, late peak. Large BEV → FEV₁ and FVC not acceptable.' },
  { id: 'cough', title: 'Cough in first second', opt: { cough: true }, text: 'Sudden flow drop and spike early in expiration. FEV₁ not acceptable; FVC may still be used.' },
  { id: 'early', title: 'Early termination', opt: { earlyTermination: true }, text: 'Abrupt fall in flow with no volume plateau. EOFE not met → FVC not acceptable (FEV₁ may be).' },
  { id: 'submax', title: 'Submaximal inspiration', opt: { submaxInspiration: true }, text: 'Did not start from TLC: FIVC exceeds FVC by > 100 mL / 5 %. Neither value acceptable.' },
];

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="mb-5">
    <h2 class="h2">Execution Method &amp; Quality Control</h2>
    <p class="lead">A spirogram is only as good as the manoeuvre. ATS/ERS 2019 defines how to perform it, when a Trial is acceptable or usable, and how to grade the session.</p>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    ${phaseCard(1, 'Maximal inspiration', 'bg-indigo-600', [
      'Inspire rapidly and completely to TLC',
      'Pause at TLC for < 2 s (longer pauses lower PEF and FEV₁)',
      'Lips sealed around the mouthpiece; noseclip on',
    ])}
    ${phaseCard(2, 'Blast out', 'bg-rose-600', [
      'Exhale with maximal effort, no hesitation',
      'BEV < 5 % of FVC or 0.100 L, whichever is greater',
      'Sharp PEF reached early (normally < 120 ms)',
    ])}
    ${phaseCard(3, 'Sustain → complete', 'bg-amber-600', [
      'Keep blowing until no more air: plateau < 0.025 L in the last 1 s, or FET ≥ 15 s',
      'Then a maximal inspiration back to TLC (FIVC)',
      'FIVC − FVC must be ≤ 0.100 L or 5 % of FVC',
    ])}
  </div>

  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div class="card card-pad">
      <h3 class="h3">Back-extrapolation &amp; time zero</h3>
      <p class="lead mb-2">Time zero is where the tangent through the steepest point of the volume–time curve (at PEF) crosses zero volume. The volume already exhaled at time zero is the BEV. FEV₁ is read 1 s after time zero.</p>
      <div class="relative h-64"><canvas id="tq-bev"></canvas></div>
      <p id="tq-bev-note" class="mt-2 text-xs text-slate-600"></p>
    </div>
    <div class="card card-pad">
      <h3 class="h3">The three phases on a real curve</h3>
      <p class="lead mb-2">Volume–time of a good manoeuvre with the ATS/ERS 2019 phases shaded.</p>
      <div class="relative h-64"><canvas id="tq-phases"></canvas></div>
    </div>
  </div>

  <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
    <div class="card card-pad lg:col-span-3">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Acceptability &amp; usability</h3><span class="tag-std">ATS/ERS 2019 Table 7</span></div>
      <div class="overflow-x-auto">
      <table class="tbl text-xs">
        <thead><tr><th>Criterion</th><th class="text-center">Acceptable FEV₁</th><th class="text-center">Acceptable FVC</th><th class="text-center">Usable FEV₁</th><th class="text-center">Usable FVC</th></tr></thead>
        <tbody>
          ${row('BEV < 5 % of FVC or 0.100 L (greater)', 1, 1, 1, 1)}
          ${row('No faulty zero-flow setting', 1, 1, 1, 1)}
          ${row('No cough in the first second', 1, 0, 1, 0)}
          ${row('No glottic closure in the first second', 1, 1, 1, 1)}
          ${row('No glottic closure after 1 s', 0, 1, 0, 0)}
          ${row('EOFE: plateau < 0.025 L in last 1 s, OR FET ≥ 15 s, OR FVC within repeatability of / greater than largest prior FVC', 0, 1, 0, 0)}
          ${row('No obstructed mouthpiece; no leak', 1, 1, 0, 0)}
          ${row('FIVC − FVC ≤ 0.100 L or 5 % of FVC (maximal inspiration)', 1, 1, 0, 0)}
        </tbody>
      </table></div>
      <p class="mt-2 text-xs text-slate-500">A <b>usable</b> value is not fully acceptable but may still be reported; the grade warns the interpreter.</p>
    </div>
    <div class="card card-pad lg:col-span-2">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Repeatability &amp; grading</h3><span class="tag-std">Table 10</span></div>
      <p class="mb-2 text-sm text-slate-700">Repeatability (age &gt; 6 y): the two largest <b>acceptable</b> FVC values differ by ≤ <b>0.150 L</b>, and likewise for FEV₁. Obtain at least 3 acceptable Trials, up to 8.</p>
      <table class="tbl text-xs">
        <thead><tr><th>Grade</th><th>Criterion (FEV₁ and FVC graded separately)</th></tr></thead>
        <tbody>${Object.entries(GRADE_TEXT).map(([g, t]) => `<tr><td class="text-center font-bold">${g}</td><td>${t}</td></tr>`).join('')}</tbody>
      </table>
      <p class="mt-2 text-xs text-slate-500">Best values: largest acceptable FEV₁ and largest acceptable FVC, even from different Trials. Flows (PEF, FEF₂₅₋₇₅) come from the Trial with the largest FEV₁ + FVC.</p>
    </div>
  </div>

  <div class="mt-6">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="h3">Error gallery</h3>
      <p class="text-xs text-slate-500">Generated live by the simulator for the current Subject, and judged by the same QC engine</p>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" id="tq-gallery"></div>
  </div>`;

  $('#tq-gallery', el).innerHTML = GALLERY.map((g) => `
    <div class="card p-3">
      <p class="text-sm font-semibold text-slate-800">${g.title}</p>
      <div class="relative mt-1 h-36"><canvas id="tq-g-${g.id}"></canvas></div>
      <p class="mt-1 text-xs text-slate-600">${g.text}</p>
      <div id="tq-g-${g.id}-qc" class="mt-2 flex flex-wrap gap-1 text-[11px]"></div>
    </div>`).join('');

  charts.push(['bev', createVtChart($('#tq-bev', el))]);
  charts.push(['phases', createVtChart($('#tq-phases', el))]);
  for (const g of GALLERY) charts.push([g.id, createFvChart($(`#tq-g-${g.id}`, el), { compact: true })]);
  store.on('subject', render);
  render();
}

export function onShow() {
  render();
}

function phaseCard(n, title, color, items) {
  return `<div class="card card-pad">
    <div class="flex items-center gap-3"><span class="flex h-8 w-8 items-center justify-center rounded-full ${color} text-sm font-bold text-white">${n}</span>
    <p class="h3">${title}</p></div>
    <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
}

function row(label, ...cells) {
  const mark = (c) => (c ? '<span class="font-bold text-emerald-600">Yes</span>' : '<span class="text-slate-400">No</span>');
  return `<tr><td>${label}</td>${cells.map((c) => `<td class="text-center">${mark(c)}</td>`).join('')}</tr>`;
}

function chartOf(id) {
  return charts.find(([k]) => k === id)[1];
}

function render() {
  if (!root) return;
  const mech = buildMechanics(store.state.subject, settingsFromPreset('normal'));

  // Back-extrapolation on a hesitant start, zoomed to the first second.
  const slow = simulateManoeuvre(mech, { slowStart: true });
  const ms = measure(slow);
  const raw = slow.t.map((t, i) => ({ x: t, y: slow.vol[i] })).filter((p) => p.x <= 1.6);
  // Zoom on the start: the first ~0.9 s of the blow.
  const iPeak = slow.flow.indexOf(Math.max(...slow.flow));
  const peakPt = { x: slow.t[iPeak], y: slow.vol[iPeak] };
  const tangent = [{ x: ms.t0, y: 0 }, { x: peakPt.x + 0.35, y: peakPt.y + 0.35 * ms.PEF }];
  const bev = chartOf('bev');
  setData(bev, [
    line('Volume–time (hesitant start)', raw, COLORS.pre, { width: 2.5 }),
    line('Tangent at PEF', tangent, '#e11d48', { width: 1.5, dash: [5, 4] }),
  ], {
    kind: 'vt',
    fixed: { xMax: 1.6, yMax: Math.max(1, Math.ceil(slow.vol[slow.t.findIndex((t) => t >= 0.9)] * 2) / 2) },
    annotations: {
      t0: { type: 'line', xMin: ms.t0, xMax: ms.t0, borderColor: '#e11d48', borderWidth: 1 },
      t0l: { type: 'label', xValue: ms.t0, yValue: 0, yAdjust: -14, xAdjust: 26, content: 'time zero', color: '#e11d48', font: { size: 11, weight: '600' } },
      bevPt: { type: 'point', xValue: ms.t0, yValue: ms.BEV, radius: 5, backgroundColor: '#e11d48' },
      bevL: { type: 'label', xValue: ms.t0, yValue: ms.BEV, xAdjust: -40, yAdjust: -14, content: `BEV ${(ms.BEV * 1000).toFixed(0)} mL`, color: '#e11d48', font: { size: 11, weight: '600' } },
    },
  });
  bev.options.scales.x.min = 0;
  bev.update('none');
  $('#tq-bev-note', root).innerHTML = `BEV ${(ms.BEV * 1000).toFixed(0)} mL vs limit ${(Math.max(0.1, 0.05 * ms.FVC) * 1000).toFixed(0)} mL → ${
    ms.BEV <= Math.max(0.1, 0.05 * ms.FVC) ? '<b class="text-emerald-700">acceptable start</b>' : '<b class="text-rose-700">unacceptable start (too much volume before time zero)</b>'}.`;

  // Phases on a good curve
  const good = simulateManoeuvre(mech, {});
  const mg = measure(good);
  const p = curvePoints(good, mg);
  const ph = chartOf('phases');
  setData(ph, [line('Volume–time', p.vt, COLORS.pre, { width: 2.5 })], {
    kind: 'vt',
    annotations: {
      a: { type: 'box', xMin: -1, xMax: 0, backgroundColor: 'rgba(79,70,229,0.08)', borderWidth: 0, label: { display: true, content: '① TLC', position: 'start', font: { size: 10 } } },
      b: { type: 'box', xMin: 0, xMax: 1, backgroundColor: 'rgba(225,29,72,0.10)', borderWidth: 0, label: { display: true, content: '② Blast', position: 'start', font: { size: 10 } } },
      c: { type: 'box', xMin: 1, xMax: mg.FET, backgroundColor: 'rgba(217,119,6,0.08)', borderWidth: 0, label: { display: true, content: '③ Sustain to plateau', position: 'start', font: { size: 10 } } },
      f1: { type: 'point', xValue: 1, yValue: mg.FEV1, radius: 4, backgroundColor: COLORS.pre },
      f1l: { type: 'label', xValue: 1, yValue: mg.FEV1, xAdjust: 30, yAdjust: 12, content: 'FEV₁', font: { size: 11, weight: '600' }, color: COLORS.pre },
      fv: { type: 'label', xValue: mg.FET - 1, yValue: mg.FVC, yAdjust: -10, content: 'FVC', font: { size: 11, weight: '600' }, color: COLORS.pre },
    },
  });

  // Gallery
  for (const g of GALLERY) {
    const c = simulateManoeuvre(mech, g.opt);
    const m = measure(c);
    const qc = judgeTrial(m, c.artefacts, null);
    const pts = curvePoints(c, m);
    setData(chartOf(g.id), [line('ref', curvePoints(good, mg).fv, COLORS.pred, { width: 1, dash: [4, 3] }), line(g.title, pts.fv, COLORS.pre, { width: 2 })], { kind: 'fv' });
    $(`#tq-g-${g.id}-qc`, root).innerHTML = `<span>FEV₁ ${statusTag(qc.fev1)}</span><span>FVC ${statusTag(qc.fvc)}</span>
      <span class="w-full text-slate-500">BEV ${fmt(m.BEV * 1000, 0)} mL · FET ${fmt(m.FET, 1)} s · FIVC−FVC ${fmt((m.FIVC - m.FVC) * 1000, 0)} mL</span>`;
  }
}
