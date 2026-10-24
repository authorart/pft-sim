/**
 * Tab 5 — Algorithmic interpretation trainer.
 * A: step-by-step walkthrough of the Simulator's current Session (ERS/ATS 2022 or Legacy).
 * B: "Interpret This Case" — randomised cases with structured answers and graded feedback.
 */
import { store } from '../state.js';
import { PRESETS, presetById, settingsFromPreset } from '../core/presets.js';
import { ETHNIC_GROUPS, REFERENCE_SETS } from '../core/reference.js';
import { autoRun, giveBronchodilator, generateCompleteSession } from '../core/session.js';
import { interpretSession, compareAll, PATTERN_LABELS, UAO_LABELS } from '../core/interpret.js';
import { predictedLoop } from '../core/model.js';
import { measure } from '../core/measure.js';
import { createFvChart, createVtChart, setData, line, curvePoints, COLORS } from '../ui/charts.js';
import { $, $$, fmt, zClass, gradeTag, escapeHtml } from '../ui/dom.js';

let root;
let caseFv;
let caseVt;
let current = null; // { session, preset, answered }
const score = { correct: 0, total: 0, cases: 0 };

const STATUS_CLS = {
  normal: 'border-emerald-300 bg-emerald-50',
  abnormal: 'border-rose-300 bg-rose-50',
  warning: 'border-amber-300 bg-amber-50',
  info: 'border-slate-200 bg-slate-50',
};

export function mount(el) {
  root = el;
  try {
    Object.assign(score, JSON.parse(localStorage.getItem('pft-sim-score') || '{}'));
  } catch {
    /* storage unavailable */
  }
  el.innerHTML = `
  <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="h2">Interpretation Trainer</h2>
      <p class="lead">Follow the ATS/ERS algorithm step by step on your own Session, then test yourself on randomised cases.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-slate-500">Standard</span>
      <div class="seg" id="tr-std"><button data-std="ers2022">ERS/ATS 2022</button><button data-std="legacy">Legacy</button></div>
      <div class="seg" id="tr-ratio" hidden><button data-ratio="lln">Ratio &lt; LLN</button><button data-ratio="fixed">Ratio &lt; 0.70</button></div>
    </div>
  </div>

  <div class="card card-pad">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="h3">A · Step-by-step: your Simulator Session</h3>
      <span id="tr-session-label" class="text-xs text-slate-500"></span>
    </div>
    <div id="tr-walk"></div>
  </div>

  <div class="card card-pad mt-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="h3">B · Interpret This Case</h3>
      <div class="flex items-center gap-3 text-xs">
        <span id="tr-score" class="text-slate-600"></span>
        <button id="tr-reset-score" class="btn-ghost px-2 py-1 text-xs">Reset score</button>
        <button id="tr-new" class="btn-primary">New case</button>
      </div>
    </div>
    <div id="tr-case" class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <div id="tr-case-head" class="mb-2 text-sm"></div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div class="relative h-56 sm:col-span-3"><canvas id="tr-fv"></canvas></div>
          <div class="relative h-56 sm:col-span-2"><canvas id="tr-vt"></canvas></div>
        </div>
        <div class="mt-3 overflow-x-auto"><table class="tbl" id="tr-table"></table></div>
      </div>
      <form id="tr-form" class="space-y-3 lg:col-span-5"></form>
    </div>
    <div id="tr-feedback" class="mt-4"></div>
  </div>`;

  caseFv = createFvChart($('#tr-fv', el), { compact: false });
  caseVt = createVtChart($('#tr-vt', el), { compact: false });
  caseFv.options.plugins.legend.display = false;
  caseVt.options.plugins.legend.display = false;

  $('#tr-std', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-std]');
    if (!b) return;
    store.setOption('standard', b.dataset.std);
  });
  $('#tr-ratio', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-ratio]');
    if (b) store.setOption('ratioMethod', b.dataset.ratio);
  });
  $('#tr-new', el).addEventListener('click', newCase);
  $('#tr-reset-score', el).addEventListener('click', () => {
    Object.assign(score, { correct: 0, total: 0, cases: 0 });
    saveScore();
  });
  $('#tr-form', el).addEventListener('submit', (e) => {
    e.preventDefault();
    gradeCase();
  });
  store.on('session', renderWalk);
  store.on('options', () => {
    syncToggles();
    renderWalk();
    if (current) renderCase();
  });
  syncToggles();
  renderWalk();
  newCase();
  saveScore();
}

export function onShow() {
  syncToggles();
  renderWalk();
}

function syncToggles() {
  const s = store.state;
  $$('#tr-std button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.std === s.standard)));
  $('#tr-ratio', root).hidden = s.standard !== 'legacy';
  $$('#tr-ratio button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ratio === s.ratioMethod)));
}

function opts() {
  const s = store.state;
  return { refSet: s.refSet, standard: s.standard, ratioMethod: s.ratioMethod };
}

/* ------------------------------------------------------------------ */
/* A · Walkthrough                                                     */
/* ------------------------------------------------------------------ */

function renderWalk() {
  if (!root) return;
  const s = store.state;
  const sess = s.session;
  const p = presetById(s.settings.presetId);
  $('#tr-session-label', root).textContent = `${p.label}${s.settings.modified ? ' (modified)' : ''} · ${s.subject.age} y ${s.subject.sex} ${s.subject.heightCm} cm`;
  if (!sess.pre.trials.length) {
    $('#tr-walk', root).innerHTML = `<div class="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-600">
      No Trials yet in the Simulator.
      <div class="mt-3 flex justify-center gap-2">
        <button class="btn-primary" id="tr-gen">Run a full Session (Pre + Post) now</button>
        <button class="btn-secondary" id="tr-goto-sim">Go to Simulator</button>
      </div></div>`;
    $('#tr-gen', root).addEventListener('click', () => {
      autoRun(sess, 'pre');
      giveBronchodilator(sess);
      autoRun(sess, 'post');
      store.touchSession();
    });
    $('#tr-goto-sim', root).addEventListener('click', () => document.dispatchEvent(new CustomEvent('pft:navigate', { detail: 'simulator' })));
    return;
  }
  const r = interpretSession(sess, opts());
  $('#tr-walk', root).innerHTML = `
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="lg:col-span-5">${flowchart(r)}</div>
      <ol class="space-y-2 lg:col-span-7">
        ${r.steps.map((st) => `<li class="rounded-lg border p-3 ${STATUS_CLS[st.status]}">
          <div class="flex flex-wrap items-baseline justify-between gap-2"><p class="text-sm font-semibold text-slate-800">${st.title}</p>
          <p class="text-sm font-semibold">${escapeHtml(st.finding)}</p></div>
          <p class="mt-1 text-xs text-slate-600">${st.detail}</p></li>`).join('')}
      </ol>
    </div>
    <div class="callout-std mt-4"><b>Conclusion:</b> ${escapeHtml(r.summary)}</div>
    ${!sess.post ? '<p class="mt-2 text-xs text-slate-500">Tip: give a bronchodilator in the Simulator to complete Step 4.</p>' : ''}`;
}

/** ERS/ATS 2022 Figure 8 decision tree with the taken path highlighted. */
function flowchart(r) {
  const s = store.state;
  const fixed = s.standard === 'legacy' && s.ratioMethod === 'fixed';
  const ratioQ = fixed ? 'FEV₁/FVC ≥ 0.70?' : 'FEV₁/FVC ≥ LLN?';
  const pat = r.pattern;
  const obs = pat === 'obstruction' || pat === 'mixed';
  const on = (cond) => (cond ? '#4f46e5' : '#cbd5e1');
  const box = (x, y, w, text, active, fill = '#fff') =>
    `<g><rect x="${x - w / 2}" y="${y - 18}" width="${w}" height="36" rx="8" fill="${active ? '#eef2ff' : fill}" stroke="${active ? '#4f46e5' : '#cbd5e1'}" stroke-width="${active ? 2 : 1}"/>
     <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="${active ? 700 : 500}" fill="${active ? '#3730a3' : '#64748b'}">${text}</text></g>`;
  const edge = (x1, y1, x2, y2, active, label) =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${on(active)}" stroke-width="${active ? 2.5 : 1.5}" marker-end="url(#arr${active ? 'A' : ''})"/>
     ${label ? `<text x="${(x1 + x2) / 2 + (x2 > x1 ? 8 : -8)}" y="${(y1 + y2) / 2}" text-anchor="${x2 > x1 ? 'start' : 'end'}" font-size="11" fill="${active ? '#4f46e5' : '#94a3b8'}">${label}</text>` : ''}`;
  if (pat === 'notInterpretable') {
    return `<div class="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">Test quality is inadequate (grade F or only usable values), so the algorithm should not be applied. Coach the Subject and repeat.</div>`;
  }
  return `<svg viewBox="0 0 400 270" class="w-full" role="img" aria-label="Interpretation flowchart">
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#cbd5e1"/></marker>
      <marker id="arrA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4f46e5"/></marker>
    </defs>
    ${edge(200, 48, 105, 100, !obs, 'Yes')}
    ${edge(200, 48, 295, 100, obs, 'No')}
    ${edge(105, 136, 55, 200, pat === 'normal', 'Yes')}
    ${edge(105, 136, 155, 200, pat === 'restriction', 'No')}
    ${edge(295, 136, 245, 200, pat === 'obstruction', 'Yes')}
    ${edge(295, 136, 345, 200, pat === 'mixed', 'No')}
    ${box(200, 30, 170, ratioQ, true)}
    ${box(105, 118, 120, 'FVC ≥ LLN?', !obs)}
    ${box(295, 118, 120, 'FVC ≥ LLN?', obs)}
    ${box(55, 222, 96, 'Normal', pat === 'normal')}
    ${box(155, 222, 96, 'Restriction?', pat === 'restriction')}
    ${box(245, 222, 96, 'Obstruction', pat === 'obstruction')}
    ${box(345, 222, 96, 'Mixed?', pat === 'mixed')}
    <text x="155" y="256" text-anchor="middle" font-size="10" fill="#64748b">non-specific / PRISm → TLC</text>
    <text x="345" y="256" text-anchor="middle" font-size="10" fill="#64748b">→ TLC to confirm</text>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* B · Interpret This Case                                             */
/* ------------------------------------------------------------------ */

function randomSubject() {
  const sex = Math.random() < 0.5 ? 'male' : 'female';
  const age = Math.round(20 + Math.random() * 62);
  const heightCm = Math.round(sex === 'male' ? 158 + Math.random() * 26 : 148 + Math.random() * 22);
  const ethnicity = Math.random() < 0.6 ? 3 : Math.floor(Math.random() * ETHNIC_GROUPS.length);
  return { age, sex, heightCm, weightKg: Math.round(((heightCm / 100) ** 2) * (19 + Math.random() * 9)), ethnicity };
}

function newCase() {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  const subject = randomSubject();
  const session = generateCompleteSession(subject, settingsFromPreset(preset.id), { withPost: true });
  current = { session, preset, answered: false, pred: measureLoop(subject) };
  renderCase();
  $('#tr-feedback', root).innerHTML = '';
}

function measureLoop(subject) {
  const curve = predictedLoop(subject);
  return { curve, m: measure(curve) };
}

function bestTrial(phase) {
  return phase?.trials.find((t) => t.id === phase.eval.bestTrialId);
}

function renderCase() {
  const { session, pred } = current;
  const s = session.subject;
  const ref = REFERENCE_SETS[store.state.refSet];
  $('#tr-case-head', root).innerHTML = `<p><b>Case:</b> ${s.age}-year-old ${s.sex}, ${s.heightCm} cm, ${s.weightKg} kg${
    ref.ethnic ? `, ${ETHNIC_GROUPS[s.ethnicity].label}` : ''} · ${ref.label}</p>
    <p class="mt-1 text-xs text-slate-500">Pre: FEV₁ grade ${gradeTag(session.pre.eval.fev1Grade)} FVC grade ${gradeTag(session.pre.eval.fvcGrade)} · ${session.pre.trials.length} Trials &nbsp;|&nbsp; Post: FEV₁ ${gradeTag(session.post.eval.fev1Grade)} FVC ${gradeTag(session.post.eval.fvcGrade)}</p>`;

  const fv = [];
  const vt = [];
  const pp = curvePoints(pred.curve, pred.m);
  fv.push(line('Predicted', pp.fv, COLORS.pred, { width: 1.5, dash: [5, 4] }));
  vt.push(line('Predicted', pp.vt, COLORS.pred, { width: 1.5, dash: [5, 4] }));
  for (const [ph, color] of [[session.pre, COLORS.pre], [session.post, COLORS.post]]) {
    const t = bestTrial(ph) ?? ph.trials.at(-1);
    if (!t) continue;
    const p = curvePoints(t.curve, t.m);
    fv.push(line(ph.bd ? 'Post' : 'Pre', p.fv, color, { width: 2.4 }));
    vt.push(line(ph.bd ? 'Post' : 'Pre', p.vt, color, { width: 2.4 }));
  }
  setData(caseFv, fv, { kind: 'fv' });
  setData(caseVt, vt, { kind: 'vt' });

  const pre = session.pre.eval.best ?? bestTrial(session.pre)?.m ?? session.pre.trials.at(-1).m;
  const post = session.post.eval.best ?? session.post.trials.at(-1).m;
  const c = compareAll(pre, s, store.state.refSet);
  const cp = compareAll(post, s, store.state.refSet);
  const rows = [['FEV1', 'FEV₁ (L)', 2], ['FVC', 'FVC (L)', 2], ['FEV1FVC', 'FEV₁/FVC (%)', 1], ['FEF2575', 'FEF₂₅₋₇₅ (L/s)', 2], ['PEF', 'PEF (L/s)', 2], ['PIF', 'PIF (L/s)', 2]];
  const v = (x, k, d) => (x == null ? '—' : k === 'FEV1FVC' ? (x * 100).toFixed(d) : x.toFixed(d));
  $('#tr-table', root).innerHTML = `<thead><tr><th></th><th class="num">Pred</th><th class="num">LLN</th><th class="num">Pre</th><th class="num">z</th><th class="num">%Pred</th><th class="num">Post</th><th class="num">z</th></tr></thead>
    <tbody>${rows.map(([k, label, d]) => `<tr><td class="font-medium">${label}</td>
      <td class="num">${v(c[k].pred, k, d)}</td><td class="num">${v(c[k].lln, k, d)}</td>
      <td class="num font-semibold ${zClass(c[k].z)}">${v(c[k].measured, k, d)}</td><td class="num ${zClass(c[k].z)}">${fmt(c[k].z, 2)}</td><td class="num">${fmt(c[k].pctPred, 0)}</td>
      <td class="num font-semibold ${zClass(cp[k].z)}">${v(cp[k].measured, k, d)}</td><td class="num ${zClass(cp[k].z)}">${fmt(cp[k].z, 2)}</td></tr>`).join('')}</tbody>`;

  const legacy = store.state.standard === 'legacy';
  const radio = (name, value, label) => `<label class="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm hover:border-indigo-300 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
    <input type="radio" name="${name}" value="${value}" required /> ${label}</label>`;
  const group = (n, title, name, options) => `<fieldset><legend class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">${n}. ${title}</legend>
    <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">${options.map(([v, l]) => radio(name, v, l)).join('')}</div></fieldset>`;
  $('#tr-form', root).innerHTML = `
    ${group(1, 'Test quality', 'quality', [['adequate', 'Adequate (grades A–C)'], ['caution', 'Interpret with caution (D/E/U)'], ['notInterpretable', 'Not interpretable (F)']])}
    ${group(2, 'Pattern', 'pattern', Object.entries(PATTERN_LABELS))}
    ${group(3, `Severity (${legacy ? 'FEV₁ % pred' : 'FEV₁ z-score'})`, 'severity', [['none', 'Not applicable / normal'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe'], ...(legacy ? [['very severe', 'Very severe']] : [])])}
    ${group(4, 'Bronchodilator response', 'bdr', [['positive', 'Positive'], ['negative', 'Not significant']])}
    ${group(5, 'Flow–volume loop shape', 'uao', Object.entries(UAO_LABELS))}
    <button type="submit" class="btn-primary w-full">Check my interpretation</button>`;
}

function gradeCase() {
  const form = new FormData($('#tr-form', root));
  const r = interpretSession(current.session, opts());
  const expected = {
    quality: r.quality.notInterp ? 'notInterpretable' : r.quality.caution ? 'caution' : 'adequate',
    pattern: r.pattern,
    severity: r.severity ?? 'none',
    bdr: r.bdr.positive ? 'positive' : 'negative',
    uao: r.uao,
  };
  const labels = {
    quality: { adequate: 'Adequate', caution: 'Interpret with caution', notInterpretable: 'Not interpretable' },
    pattern: PATTERN_LABELS,
    severity: { none: 'Not applicable', mild: 'Mild', moderate: 'Moderate', severe: 'Severe', 'very severe': 'Very severe' },
    bdr: { positive: 'Positive', negative: 'Not significant' },
    uao: UAO_LABELS,
  };
  const why = {
    quality: r.steps.find((x) => x.id === 'quality')?.detail,
    pattern: [r.steps.find((x) => x.id === 'ratio')?.detail, r.steps.find((x) => x.id === 'fvc')?.detail].filter(Boolean).join(' '),
    severity: r.steps.find((x) => x.id === 'severity')?.detail ?? 'Severity is graded only when the pattern is abnormal.',
    bdr: r.steps.find((x) => x.id === 'bdr')?.detail ?? 'Not assessable when the test is not interpretable.',
    uao: r.steps.find((x) => x.id === 'uao')?.detail ?? 'Not assessable when the test is not interpretable.',
  };
  const titles = { quality: 'Test quality', pattern: 'Pattern', severity: 'Severity', bdr: 'Bronchodilator response', uao: 'Loop shape' };
  // When the test is not interpretable, only the quality judgement is scored.
  const keys = r.quality.notInterp ? ['quality'] : Object.keys(expected);
  let correct = 0;
  const items = keys.map((k) => {
    const ok = form.get(k) === expected[k];
    if (ok) correct++;
    return `<li class="rounded-lg border p-3 ${ok ? STATUS_CLS.normal : STATUS_CLS.abnormal}">
      <p class="text-sm"><b>${ok ? '✓' : '✗'} ${titles[k]}:</b> ${ok ? '' : `you said “${escapeHtml(labels[k][form.get(k)] ?? '—')}”; `}answer <b>${escapeHtml(labels[k][expected[k]])}</b></p>
      <p class="mt-1 text-xs text-slate-600">${why[k] ?? ''}</p></li>`;
  });
  if (!current.answered) {
    score.correct += correct;
    score.total += keys.length;
    score.cases += 1;
    current.answered = true;
    saveScore();
  }
  $('#tr-feedback', root).innerHTML = `
    <div class="rounded-xl border border-indigo-200 bg-white p-4">
      <p class="text-sm font-semibold text-slate-800">${correct}/${keys.length} correct · Preset was <span class="text-indigo-700">${current.preset.label}</span></p>
      <ul class="mt-3 grid gap-2 md:grid-cols-2">${items.join('')}</ul>
      <div class="callout-std mt-3"><b>Model interpretation:</b> ${escapeHtml(r.summary)}</div>
    </div>`;
}

function saveScore() {
  try {
    localStorage.setItem('pft-sim-score', JSON.stringify(score));
  } catch {
    /* storage unavailable */
  }
  if (root) $('#tr-score', root).textContent = `Score ${score.correct}/${score.total} · ${score.cases} cases`;
}
