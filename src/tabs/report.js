/**
 * Tab 6 — Vyntus SPIRO–style printable report of the Simulator's current Session.
 * A4 layout: header, patient block, Pre/Post table with z-score plot, graphs, quality,
 * interpretation and technician comment. Printing hides the application chrome.
 */
import { store } from '../state.js';
import { presetById } from '../core/presets.js';
import { ETHNIC_GROUPS, REFERENCE_SETS, Z_LLN } from '../core/reference.js';
import { autoRun, giveBronchodilator } from '../core/session.js';
import { interpretSession, compareAll, REPORT_PARAMS, STANDARDS } from '../core/interpret.js';
import { predictedLoop } from '../core/model.js';
import { measure } from '../core/measure.js';
import { createFvChart, createVtChart, setData, line, curvePoints, COLORS } from '../ui/charts.js';
import { $, $$, fmt, fmtParam, escapeHtml } from '../ui/dom.js';

let root;
let fv;
let vt;
let printedAt = new Date();

export function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="h2">Spirometry Report</h2>
      <p class="lead">Vyntus SPIRO–style summary of the Simulator's current Session. Fields with a dashed outline are editable. Use <b>Print / Save PDF</b> for an A4 copy.</p>
    </div>
    <div class="flex gap-2">
      <button id="rp-demo" class="btn-secondary">Run full Session</button>
      <button id="rp-print" class="btn-primary">🖨 Print / Save PDF</button>
    </div>
  </div>
  <div id="rp-empty" class="no-print"></div>
  <div class="overflow-x-auto pb-4">
    <article id="rp-page" class="report-page relative mx-auto w-[210mm] min-h-[287mm] overflow-hidden border border-slate-300 bg-white p-[10mm] text-[10.5px] leading-snug text-slate-900 shadow-lg"></article>
  </div>`;

  $('#rp-print', el).addEventListener('click', () => window.print());
  $('#rp-demo', el).addEventListener('click', () => {
    const s = store.state.session;
    autoRun(s, 'pre');
    giveBronchodilator(s);
    autoRun(s, 'post');
    store.touchSession();
  });
  store.on('session', () => !root.closest('[hidden]') && render());
  store.on('options', () => !root.closest('[hidden]') && render());
  render();
}

export function onShow() {
  render();
}

const editable = (key, value, cls = '') =>
  `<input data-field="${key}" value="${escapeHtml(value)}" class="w-full rounded border border-dashed border-slate-300 bg-transparent px-1 py-0.5 ${cls} focus:border-indigo-500 focus:outline-none" />`;

function render() {
  if (!root) return;
  const s = store.state;
  const sess = s.session;
  const rep = s.report;
  printedAt = new Date();
  const hasPre = !!sess.pre.eval.best;
  $('#rp-demo', root).hidden = hasPre && !!sess.post?.eval.best;
  $('#rp-empty', root).innerHTML = hasPre
    ? ''
    : `<div class="callout-warn mb-4">The current Session has no acceptable/usable Trials yet. Run Trials in the Simulator, or press <b>Run full Session</b> to generate Pre and Post sets for the selected Preset.</div>`;

  const subj = s.subject;
  const ref = REFERENCE_SETS[s.refSet];
  const bmi = subj.weightKg / (subj.heightCm / 100) ** 2;
  const dob = new Date(printedAt);
  dob.setFullYear(dob.getFullYear() - subj.age);
  const pre = sess.pre.eval;
  const post = sess.post?.eval;
  const c = hasPre ? compareAll(pre.best, subj, s.refSet) : null;
  const cp = post?.best ? compareAll(post.best, subj, s.refSet) : null;
  const interp = hasPre ? interpretSession(sess, { refSet: s.refSet, standard: s.standard, ratioMethod: s.ratioMethod }) : null;
  if (!rep.interpretationEdited) rep.interpretation = interp ? interp.summary : '';

  const date = printedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = printedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  $('#rp-page', root).innerHTML = `
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p class="-rotate-30 select-none whitespace-nowrap text-[34px] font-black tracking-widest text-rose-600/10">SIMULATED – NOT FOR CLINICAL USE</p>
    </div>

    <header class="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-2">
      <div class="w-[60%]">
        ${editable('institution', rep.institution, 'text-[14px] font-bold')}
        ${editable('department', rep.department, 'text-[11px] text-slate-600')}
      </div>
      <div class="text-right">
        <p class="text-[18px] font-black tracking-wide text-slate-800">SPIROMETRY</p>
        <p class="text-[10px] text-slate-500">Forced manoeuvre · Pre/Post bronchodilator</p>
        <p class="text-[10px] text-slate-500">${date} ${time}</p>
      </div>
    </header>

    <section class="mt-2 grid grid-cols-3 gap-x-4 gap-y-0.5 border-b border-slate-300 pb-2">
      ${kv('Name', editable('patientName', rep.patientName, 'font-semibold'))}
      ${kv('ID / HN', editable('patientId', rep.patientId))}
      ${kv('Date of birth', `${dob.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} <span class="text-slate-400">(calc.)</span>`)}
      ${kv('Age', `${subj.age} years`)}
      ${kv('Sex', subj.sex === 'male' ? 'Male' : 'Female')}
      ${kv('Ethnicity', ref.ethnic ? ETHNIC_GROUPS[subj.ethnicity].label : 'n/a (race-neutral)')}
      ${kv('Height', `${subj.heightCm} cm`)}
      ${kv('Weight', `${subj.weightKg} kg`)}
      ${kv('BMI', `${bmi.toFixed(1)} kg/m²`)}
      ${kv('Predicted', ref.label)}
      ${kv('Interpretation', STANDARDS[s.standard].label.replace(' · GOLD-style grades', ''))}
      ${kv('Bronchodilator', sess.post ? 'Salbutamol 400 µg, 15 min' : 'Not given')}
      ${kv('Operator', editable('operator', rep.operator))}
      ${kv('Referring physician', editable('physician', rep.physician))}
      ${kv('Scenario', `${presetById(s.settings.presetId).short}${s.settings.modified ? ' (modified)' : ''}`)}
    </section>

    <section class="mt-2">
      <table class="w-full border-collapse text-[10px]">
        <thead>
          <tr class="border-b border-slate-800 text-left">
            <th class="py-1 pr-1">Parameter</th><th class="pr-1">Unit</th>
            <th class="pr-1 text-right">Pred</th><th class="pr-1 text-right">LLN</th>
            <th class="pr-1 text-right">Pre</th><th class="pr-1 text-right">%Pred</th><th class="pr-1 text-right">Z-score</th>
            <th class="w-[34mm] px-1 text-center">${zAxisHeader()}</th>
            <th class="pr-1 text-right">Post</th><th class="pr-1 text-right">%Pred</th><th class="pr-1 text-right">Z-score</th><th class="text-right">%Chg</th>
          </tr>
        </thead>
        <tbody>
          ${REPORT_PARAMS.map((p) => reportRow(p, c?.[p.key], cp?.[p.key])).join('')}
        </tbody>
      </table>
      <p class="mt-0.5 text-[9px] text-slate-500">Z-score plot: ● Pre ▲ Post; shaded band = below LLN (z &lt; −1.645). Parameters without a GLI equation are reported as measured. Best values per ATS/ERS 2019.</p>
    </section>

    <section class="mt-2 grid grid-cols-5 gap-3">
      <div class="col-span-3"><p class="text-[10px] font-semibold">Flow–Volume</p><div class="relative h-[70mm]"><canvas id="rp-fv"></canvas></div></div>
      <div class="col-span-2"><p class="text-[10px] font-semibold">Volume–Time</p><div class="relative h-[70mm]"><canvas id="rp-vt"></canvas></div></div>
    </section>
    <p class="text-[9px] text-slate-500"><span style="color:${COLORS.pre}">━</span> Pre (best) &nbsp; <span style="color:${COLORS.post}">━</span> Post (best) &nbsp; <span style="color:${COLORS.pred}">╌</span> Predicted</p>

    <section class="mt-2 grid grid-cols-2 gap-3 border-t border-slate-300 pt-2">
      <div>
        <p class="font-semibold">Test quality (ATS/ERS 2019)</p>
        <table class="mt-0.5 w-full text-[10px]">
          <tr class="text-slate-500"><td></td><td>Trials</td><td>FEV₁ grade</td><td>FVC grade</td><td>ΔFEV₁ / ΔFVC (mL)</td></tr>
          ${qualityRow('Pre', sess.pre)}
          ${sess.post ? qualityRow('Post', sess.post) : ''}
        </table>
      </div>
      <div>
        <p class="font-semibold">Technician comment</p>
        <textarea data-field="technicianComment" rows="3" class="mt-0.5 w-full rounded border border-dashed border-slate-300 bg-transparent p-1 text-[10px] focus:border-indigo-500 focus:outline-none" placeholder="e.g. Good effort and cooperation.">${escapeHtml(rep.technicianComment)}</textarea>
      </div>
    </section>

    <section class="mt-2 border-t border-slate-300 pt-2">
      <p class="font-semibold">Interpretation</p>
      <textarea data-field="interpretation" rows="3" class="mt-0.5 w-full rounded border border-dashed border-slate-300 bg-transparent p-1 text-[11px] focus:border-indigo-500 focus:outline-none">${escapeHtml(rep.interpretation)}</textarea>
      <div class="mt-3 flex justify-between text-[10px]">
        <span>Interpreted by: ______________________</span><span>Date: ______________</span>
      </div>
    </section>

    <footer class="mt-4 flex justify-between border-t border-slate-300 pt-1 text-[8.5px] text-slate-500">
      <span>© 2026 Siro Jantharaksa, MD · PFT Simulator — simulated data for medical education, not a medical record.</span>
      <span>Page 1 / 1</span>
    </footer>`;

  $$('[data-field]', root).forEach((inp) =>
    inp.addEventListener('input', () => {
      rep[inp.dataset.field] = inp.value;
      if (inp.dataset.field === 'interpretation') rep.interpretationEdited = true;
    }));

  fv?.destroy();
  vt?.destroy();
  fv = createFvChart($('#rp-fv', root), { compact: false });
  vt = createVtChart($('#rp-vt', root), { compact: false });
  for (const ch of [fv, vt]) {
    ch.options.plugins.legend.display = false;
    ch.options.devicePixelRatio = 2;
  }
  drawGraphs();
}

function kv(k, v) {
  return `<div class="flex items-center gap-1"><span class="w-[26mm] shrink-0 text-slate-500">${k}</span><span class="min-w-0 flex-1">${v}</span></div>`;
}

const Z_MIN = -5;
const Z_MAX = 3;
const zx = (z, w = 120) => ((Math.max(Z_MIN, Math.min(Z_MAX, z)) - Z_MIN) / (Z_MAX - Z_MIN)) * w;

function zAxisHeader() {
  const ticks = [-5, -4, -3, -2, -1, 0, 1, 2, 3];
  return `<svg viewBox="-6 0 132 14" class="h-[4mm] w-full">${ticks.map((t) => `<text x="${zx(t)}" y="10" font-size="7" text-anchor="middle" fill="#334155">${t}</text>`).join('')}</svg>`;
}

function zPlot(zPre, zPost) {
  if (zPre == null && zPost == null) return '';
  const lln = zx(Z_LLN);
  const mark = [];
  if (Number.isFinite(zPre)) mark.push(`<circle cx="${zx(zPre)}" cy="6" r="3" fill="${COLORS.pre}"/>`);
  if (Number.isFinite(zPost)) mark.push(`<path d="M${zx(zPost)} 2.5 l3 6 h-6 z" fill="${COLORS.post}"/>`);
  return `<svg viewBox="-6 0 132 12" class="h-[3.2mm] w-full">
    <rect x="0" y="1" width="${lln}" height="10" fill="#fecdd3" opacity="0.7"/>
    <rect x="${lln}" y="1" width="${zx(1.645) - lln}" height="10" fill="#e2e8f0" opacity="0.6"/>
    <line x1="${zx(0)}" y1="0" x2="${zx(0)}" y2="12" stroke="#64748b" stroke-width="0.6"/>
    ${mark.join('')}</svg>`;
}

function reportRow(p, r, q) {
  const cell = (v) => `<td class="pr-1 text-right font-mono tabular-nums">${v}</td>`;
  const low = (x) => (x?.z != null && x.z < Z_LLN ? 'font-bold' : '');
  const chg = r?.measured && q?.measured != null && !['FET', 'BEV'].includes(p.key) ? (((q.measured - r.measured) / r.measured) * 100).toFixed(0) : '';
  return `<tr class="border-b border-slate-200">
    <td class="py-[3px] pr-1 font-semibold">${p.label}</td><td class="pr-1 text-slate-500">${p.unit}</td>
    ${cell(fmtParam(p, r?.pred))}${cell(fmtParam(p, r?.lln))}
    <td class="pr-1 text-right font-mono tabular-nums ${low(r)}">${fmtParam(p, r?.measured)}</td>
    ${cell(fmt(r?.pctPred, 0))}<td class="pr-1 text-right font-mono tabular-nums ${low(r)}">${fmt(r?.z, 2)}</td>
    <td class="px-1">${p.gli ? zPlot(r?.z, q?.z) : ''}</td>
    <td class="pr-1 text-right font-mono tabular-nums ${low(q)}">${q ? fmtParam(p, q.measured) : ''}</td>
    ${cell(q ? fmt(q.pctPred, 0) : '')}<td class="pr-1 text-right font-mono tabular-nums ${low(q)}">${q ? fmt(q.z, 2) : ''}</td>
    <td class="text-right font-mono tabular-nums">${chg && +chg > 0 ? '+' : ''}${chg}</td>
  </tr>`;
}

function qualityRow(label, phase) {
  const e = phase.eval;
  const d = (x) => (x == null ? '—' : (x * 1000).toFixed(0));
  return `<tr><td class="font-semibold">${label}</td><td>${phase.trials.filter((t) => t.included).length}</td>
    <td class="font-bold">${phase.trials.length ? e.fev1Grade : '—'}</td><td class="font-bold">${phase.trials.length ? e.fvcGrade : '—'}</td>
    <td>${d(e.fev1Diff)} / ${d(e.fvcDiff)}</td></tr>`;
}

function drawGraphs() {
  const s = store.state;
  const curve = predictedLoop(s.subject);
  const pm = measure(curve);
  const pp = curvePoints(curve, pm);
  const fvSets = [line('Predicted', pp.fv, COLORS.pred, { width: 1.2, dash: [5, 4] })];
  const vtSets = [line('Predicted', pp.vt, COLORS.pred, { width: 1.2, dash: [5, 4] })];
  for (const [phase, color] of [[s.session.pre, COLORS.pre], [s.session.post, COLORS.post]]) {
    const t = phase?.trials.find((x) => x.id === phase.eval.bestTrialId);
    if (!t) continue;
    const p = curvePoints(t.curve, t.m);
    fvSets.push(line(phase.bd ? 'Post' : 'Pre', p.fv, color, { width: 2 }));
    vtSets.push(line(phase.bd ? 'Post' : 'Pre', p.vt, color, { width: 2 }));
  }
  setData(fv, fvSets, { kind: 'fv' });
  setData(vt, vtSets, { kind: 'vt' });
}
