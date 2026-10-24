/**
 * Tab 4 — Interactive Spirometry Simulator.
 * Left: Subject, reference set, Preset chips and physiology sliders.
 * Right: Trial controls, animated flow–volume / volume–time charts, Trial list, QC and results.
 */
import { store } from '../state.js';
import { PRESETS, presetById, settingsFromPreset } from '../core/presets.js';
import { ETHNIC_GROUPS, REFERENCE_SETS } from '../core/reference.js';
import { simulateManoeuvre, predictedLoop } from '../core/model.js';
import { measure } from '../core/measure.js';
import { runTrial, autoRun, giveBronchodilator, setTrialIncluded, MAX_TRIALS } from '../core/session.js';
import { compareAll, interpretSession, REPORT_PARAMS } from '../core/interpret.js';
import { GRADE_TEXT } from '../core/qc.js';
import { createFvChart, createVtChart, setData, line, curvePoints, vtAnnotations, COLORS } from '../ui/charts.js';
import { $, $$, fmt, fmtParam, zClass, statusTag, gradeTag, escapeHtml, ARTEFACT_LABELS } from '../ui/dom.js';

let root;
let fvChart;
let vtChart;
let animating = false;
let skipRequested = false;
const predCache = new Map();

function predicted(subject) {
  const key = `${subject.age}|${subject.sex}|${subject.heightCm}|${subject.ethnicity}`;
  if (!predCache.has(key)) {
    const curve = predictedLoop(subject);
    predCache.set(key, { curve, m: measure(curve) });
  }
  return predCache.get(key);
}

/** Ideal (noise-free) manoeuvre for the current physiology, shown before any Trial is run. */
function previewTrial() {
  const { session } = store.state;
  const phase = session[store.state.phase] ?? session.pre;
  const curve = simulateManoeuvre(phase.mech, {});
  return { curve, m: measure(curve) };
}

export function mount(el) {
  root = el;
  el.innerHTML = template();
  fvChart = createFvChart($('#sim-fv', el));
  vtChart = createVtChart($('#sim-vt', el));
  bindControls();
  syncControls();
  renderSession();
  store.on('session', () => !animating && renderSession());
  store.on('options', () => renderSession());
}

export function onShow() {
  syncControls();
  renderSession();
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

function template() {
  const ethnicOptions = ETHNIC_GROUPS.map((g) => `<option value="${g.id}">${g.label}</option>`).join('');
  const refOptions = Object.values(REFERENCE_SETS).map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
  const chips = PRESETS.map((p) => `<button class="chip" data-preset="${p.id}" aria-pressed="false">${p.short}</button>`).join('');
  return `
  <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 class="h2">Interactive Spirometry Simulator</h2>
      <p class="lead">Choose a Subject and a Preset, then run Trials as a technician would. Each Trial is checked against ATS/ERS 2019 criteria.</p>
    </div>
    <div class="flex flex-wrap gap-2 text-xs">
      <span class="tag-std">Reference: <span id="sim-ref-label" class="ml-1"></span></span>
      <span class="tag-std">QC: ATS/ERS 2019</span>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
    <aside class="space-y-4 lg:col-span-4">
      <div class="card card-pad">
        <h3 class="card-title mb-3">Subject</h3>
        <div class="grid grid-cols-2 gap-3">
          <label class="col-span-1"><span class="field-label">Age (years)</span>
            <input id="in-age" type="number" min="18" max="90" step="1" class="input" /></label>
          <div class="col-span-1"><span class="field-label">Sex (biological)</span>
            <div class="seg w-full" id="in-sex">
              <button data-sex="male" class="flex-1">Male</button><button data-sex="female" class="flex-1">Female</button>
            </div></div>
          <label><span class="field-label">Height (cm)</span>
            <input id="in-height" type="number" min="130" max="210" step="1" class="input" /></label>
          <label><span class="field-label">Weight (kg)</span>
            <input id="in-weight" type="number" min="30" max="200" step="1" class="input" /></label>
          <label class="col-span-2"><span class="field-label">Reference equations</span>
            <select id="in-ref" class="input">${refOptions}</select></label>
          <label class="col-span-2"><span class="field-label">GLI-2012 ethnic group</span>
            <select id="in-eth" class="input">${ethnicOptions}</select></label>
        </div>
        <p id="sim-subject-note" class="mt-2 text-xs text-slate-500"></p>
      </div>

      <div class="card card-pad">
        <h3 class="card-title mb-3">Preset</h3>
        <div class="flex flex-wrap gap-1.5" id="sim-presets">${chips}</div>
        <div class="mt-3 rounded-lg bg-slate-50 p-3">
          <p class="text-sm font-semibold text-slate-800"><span id="sim-preset-name"></span> <span id="sim-modified" class="tag-warn ml-1" hidden>modified</span></p>
          <p id="sim-preset-desc" class="mt-1 text-xs leading-relaxed text-slate-600"></p>
          <p class="mt-2 text-xs text-slate-500">Expected: <span id="sim-preset-expected" class="font-medium text-slate-700"></span></p>
        </div>
      </div>

      <div class="card card-pad">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="card-title">Physiology</h3>
          <button id="sim-reset-sliders" class="btn-ghost px-2 py-1 text-xs">Reset to Preset</button>
        </div>
        ${slider('effort', 'Effort', 20, 100, 1, '%', 'Muscle drive and coaching. Low effort → low, rounded PEF, slow start, early stop.')}
        ${slider('raw', 'Airway resistance (Raw factor)', 0.5, 4, 0.05, '×', 'Higher Raw → lower flows and FEV₁/FVC, concave (scooped) limb, gas trapping.')}
        ${slider('est', 'Lung elastance (Est factor)', 0.3, 3, 0.05, '×', 'High Est (stiff lung, fibrosis) → small FVC, high FEV₁/FVC. Low Est (emphysema) → loss of recoil, scooping, hyperinflation.')}
        <p class="mt-1 text-[11px] text-slate-500">Changing the Subject or physiology starts a new Session.</p>
      </div>
    </aside>

    <div class="space-y-4 lg:col-span-8">
      <div class="card card-pad">
        <div class="flex flex-wrap items-center gap-2">
          <div class="seg" id="sim-phase">
            <button data-phase="pre">Pre</button><button data-phase="post">Post-BD</button>
          </div>
          <button id="btn-run" class="btn-primary">▶ Run Trial</button>
          <button id="btn-auto" class="btn-secondary" title="Run Trials until 3 acceptable & repeatable (max 8), without animation">⏩ Auto Session</button>
          <button id="btn-bd" class="btn-sky" title="Salbutamol 400 µg via spacer, wait 15 minutes">💨 Give bronchodilator</button>
          <button id="btn-new" class="btn-ghost">↺ New Session</button>
          <div class="ml-auto flex items-center gap-2 text-xs text-slate-600">
            <label class="flex items-center gap-1"><input id="in-animate" type="checkbox" /> Animate</label>
            <select id="in-speed" class="input w-auto py-1 text-xs">
              <option value="1">1×</option><option value="2">2×</option><option value="4">4×</option>
            </select>
          </div>
        </div>
        <div id="sim-phase-steps" class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div data-step="1" class="rounded-md border border-slate-200 px-2 py-1.5 text-slate-500">① Maximal inspiration</div>
          <div data-step="2" class="rounded-md border border-slate-200 px-2 py-1.5 text-slate-500">② Blast out</div>
          <div data-step="3" class="rounded-md border border-slate-200 px-2 py-1.5 text-slate-500">③ Sustain → plateau, then inspire</div>
        </div>
      </div>

      <div class="card card-pad relative">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div class="md:col-span-3">
            <p class="mb-1 text-xs font-semibold text-slate-600">Flow–Volume loop</p>
            <div class="relative h-80"><canvas id="sim-fv" aria-label="Flow-volume loop"></canvas></div>
          </div>
          <div class="md:col-span-2">
            <p class="mb-1 text-xs font-semibold text-slate-600">Volume–Time curve</p>
            <div class="relative h-80"><canvas id="sim-vt" aria-label="Volume-time curve"></canvas></div>
          </div>
        </div>
        <div id="sim-coach" class="coach pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-indigo-600 px-5 py-2 text-lg font-bold text-white opacity-0 shadow-lg"></div>
        <button id="btn-skip" class="btn-secondary absolute bottom-3 right-3 px-2 py-1 text-xs" hidden>Skip ⏭</button>
        <p id="sim-chart-note" class="mt-2 text-xs text-slate-500"></p>
      </div>

      <div class="card card-pad">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title">Trials <span id="sim-trial-count" class="normal-case text-slate-400"></span></h3>
          <div id="sim-grades" class="flex flex-wrap items-center gap-3 text-xs"></div>
        </div>
        <div class="overflow-x-auto"><table class="tbl" id="sim-trials"></table></div>
        <div id="sim-trial-detail" class="mt-3"></div>
      </div>

      <div class="card card-pad">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title">Results <span class="normal-case text-slate-400">· Best values (ATS/ERS 2019)</span></h3>
          <span id="sim-results-src" class="text-xs text-slate-500"></span>
        </div>
        <div class="overflow-x-auto"><table class="tbl" id="sim-results"></table></div>
        <p class="mt-2 text-[11px] text-slate-500">LLN = 5th percentile (z = −1.645). Rows without a GLI equation show measured values only. Values below LLN are shown in red.</p>
        <div id="sim-quick" class="mt-3"></div>
      </div>

      <div class="card card-pad">
        <h3 class="card-title mb-2">Static lung volumes <span class="normal-case text-slate-400">· illustrative</span></h3>
        <div id="sim-volumes"></div>
      </div>
    </div>
  </div>`;
}

function slider(id, label, min, max, step, unit, help) {
  return `
  <div class="mb-3">
    <div class="flex items-baseline justify-between">
      <label for="sl-${id}" class="text-xs font-medium text-slate-700">${label}</label>
      <span id="val-${id}" class="font-mono text-xs font-semibold text-indigo-700"></span>
    </div>
    <input id="sl-${id}" type="range" min="${min}" max="${max}" step="${step}" data-unit="${unit}" class="w-full" />
    <p class="text-[11px] leading-snug text-slate-500">${help}</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function bindControls() {
  const s = store.state;
  const num = (id, key, lo, hi) => {
    $(id, root).addEventListener('change', (e) => {
      const v = Math.min(hi, Math.max(lo, Math.round(+e.target.value || lo)));
      e.target.value = v;
      store.setSubject({ [key]: v });
    });
  };
  num('#in-age', 'age', 18, 90);
  num('#in-height', 'heightCm', 130, 210);
  num('#in-weight', 'weightKg', 30, 200);
  $('#in-sex', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-sex]');
    if (b) {
      store.setSubject({ sex: b.dataset.sex });
      syncControls();
    }
  });
  $('#in-eth', root).addEventListener('change', (e) => store.setSubject({ ethnicity: +e.target.value }));
  $('#in-ref', root).addEventListener('change', (e) => {
    store.setOption('refSet', e.target.value);
    syncControls();
  });

  $('#sim-presets', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    store.setSettings(settingsFromPreset(b.dataset.preset), { fromPreset: true });
    syncControls();
  });
  $('#sim-reset-sliders', root).addEventListener('click', () => {
    store.setSettings(settingsFromPreset(s.settings.presetId), { fromPreset: true });
    syncControls();
  });
  for (const id of ['effort', 'raw', 'est']) {
    const el = $(`#sl-${id}`, root);
    el.addEventListener('input', () => {
      updateSliderLabel(id);
      store.setSettings({ [id]: +el.value });
      $('#sim-modified', root).hidden = !s.settings.modified;
    });
  }

  $('#sim-phase', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-phase]');
    if (!b || animating) return;
    if (b.dataset.phase === 'post' && !s.session.post) return;
    s.phase = b.dataset.phase;
    s.selectedTrialId = null;
    renderSession();
  });
  $('#btn-run', root).addEventListener('click', onRunTrial);
  $('#btn-auto', root).addEventListener('click', () => {
    autoRun(s.session, s.phase);
    s.selectedTrialId = null;
    store.touchSession();
  });
  $('#btn-bd', root).addEventListener('click', () => {
    giveBronchodilator(s.session);
    s.phase = 'post';
    s.selectedTrialId = null;
    store.touchSession();
  });
  $('#btn-new', root).addEventListener('click', () => store.resetSession());
  $('#in-animate', root).addEventListener('change', (e) => (s.animate = e.target.checked));
  $('#in-speed', root).addEventListener('change', (e) => (s.speed = +e.target.value));
  $('#btn-skip', root).addEventListener('click', () => (skipRequested = true));

  $('#sim-trials', root).addEventListener('click', (e) => {
    const cb = e.target.closest('input[data-include]');
    if (cb) {
      setTrialIncluded(s.session, s.phase, cb.dataset.include, cb.checked);
      store.touchSession();
      return;
    }
    const row = e.target.closest('tr[data-trial]');
    if (row) {
      s.selectedTrialId = row.dataset.trial;
      renderSession();
    }
  });
}

function updateSliderLabel(id) {
  const el = $(`#sl-${id}`, root);
  const v = +el.value;
  $(`#val-${id}`, root).textContent = id === 'effort' ? `${v.toFixed(0)} %` : `${v.toFixed(2)} ×`;
}

function syncControls() {
  if (!root) return;
  const s = store.state;
  $('#in-age', root).value = s.subject.age;
  $('#in-height', root).value = s.subject.heightCm;
  $('#in-weight', root).value = s.subject.weightKg;
  $$('#in-sex button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sex === s.subject.sex)));
  $('#in-ref', root).value = s.refSet;
  const eth = $('#in-eth', root);
  eth.value = s.subject.ethnicity;
  eth.disabled = !REFERENCE_SETS[s.refSet].ethnic;
  $('#sim-ref-label', root).textContent = REFERENCE_SETS[s.refSet].label;
  const bmi = s.subject.weightKg / (s.subject.heightCm / 100) ** 2;
  $('#sim-subject-note', root).textContent = `BMI ${bmi.toFixed(1)} kg/m²${
    REFERENCE_SETS[s.refSet].ethnic ? '' : ' · GLI Global is race-neutral: ethnic group is ignored for reference values.'}`;

  const p = presetById(s.settings.presetId);
  $$('#sim-presets .chip', root).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.preset === p.id)));
  $('#sim-preset-name', root).textContent = p.label;
  $('#sim-preset-desc', root).textContent = p.description;
  $('#sim-preset-expected', root).textContent = p.expected;
  $('#sim-modified', root).hidden = !s.settings.modified;
  for (const id of ['effort', 'raw', 'est']) {
    $(`#sl-${id}`, root).value = s.settings[id];
    updateSliderLabel(id);
  }
  $('#in-animate', root).checked = s.animate;
  $('#in-speed', root).value = String(s.speed);
}

/* ------------------------------------------------------------------ */
/* Running Trials (with animation)                                     */
/* ------------------------------------------------------------------ */

async function onRunTrial() {
  const s = store.state;
  if (animating) return;
  const trial = runTrial(s.session, s.phase);
  if (!trial) return;
  s.selectedTrialId = trial.id;
  if (s.animate) await animateTrial(trial);
  store.touchSession();
}

function setCoach(text, color = 'bg-indigo-600', pulse = false) {
  const c = $('#sim-coach', root);
  c.textContent = text;
  c.className = `coach pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full px-5 py-2 text-lg font-bold text-white shadow-lg ${color} ${text ? 'opacity-100' : 'opacity-0'} ${pulse ? 'pulse' : ''}`;
}

function setStep(n) {
  $$('#sim-phase-steps [data-step]', root).forEach((d) => {
    const on = +d.dataset.step === n;
    d.className = `rounded-md border px-2 py-1.5 ${on ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700' : 'border-slate-200 text-slate-500'}`;
  });
}

function animateTrial(trial) {
  animating = true;
  skipRequested = false;
  setButtonsDisabled(true);
  $('#btn-skip', root).hidden = false;
  const s = store.state;
  const pred = predicted(s.subject);
  const leadIn = 1.0; // seconds of real time for the "breathe in" cue
  const total = trial.curve.endTime + 1.3;
  const start = performance.now();
  const color = trial.phase === 'post' ? COLORS.post : COLORS.pre;

  return new Promise((resolve) => {
    const frame = (now) => {
      const real = (now - start) / 1000;
      let tm = (real - leadIn) * s.speed;
      if (skipRequested) tm = total;
      if (real < leadIn && !skipRequested) {
        setCoach('Breathe in — all the way!', 'bg-indigo-600');
        setStep(1);
        tm = -1;
      } else if (tm < 1) {
        setCoach('BLAST out!', 'bg-rose-600', true);
        setStep(2);
      } else if (tm < trial.curve.endTime) {
        setCoach('Keep going… keep pushing!', 'bg-amber-600', true);
        setStep(3);
      } else if (tm < total) {
        setCoach('Big breath IN!', 'bg-sky-600');
        setStep(3);
      }
      const pts = curvePoints(trial.curve, trial.m, tm);
      drawCharts({ pred, live: { pts, color } });

      if (tm >= total) {
        const ok = trial.qc.fev1 === 'acceptable' && trial.qc.fvc === 'acceptable';
        setCoach(ok ? '✓ Acceptable Trial' : `✗ ${trial.qc.reasons[0] ?? 'Check Trial'}`, ok ? 'bg-emerald-600' : 'bg-rose-600');
        setStep(0);
        setTimeout(() => setCoach(''), 1400);
        animating = false;
        $('#btn-skip', root).hidden = true;
        setButtonsDisabled(false);
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function setButtonsDisabled(disabled) {
  for (const id of ['#btn-run', '#btn-auto', '#btn-bd', '#btn-new']) $(id, root).disabled = disabled;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function currentPhase() {
  const s = store.state;
  if (s.phase === 'post' && !s.session.post) s.phase = 'pre';
  return s.session[s.phase];
}

function selectedTrial() {
  const s = store.state;
  const phase = currentPhase();
  const id = s.selectedTrialId ?? phase.eval.bestTrialId;
  return phase.trials.find((t) => t.id === id) ?? phase.trials[phase.trials.length - 1] ?? null;
}

/** Draw charts: predicted overlay, faint Trials of the current phase, highlighted Trials. */
function drawCharts({ pred, live } = {}) {
  const s = store.state;
  pred ??= predicted(s.subject);
  const phase = currentPhase();
  const fvSets = [];
  const vtSets = [];
  const predPts = curvePoints(pred.curve, pred.m);
  fvSets.push(line('Predicted', predPts.fv, COLORS.pred, { width: 1.5, dash: [5, 4], order: 10 }));
  vtSets.push(line('Predicted', predPts.vt, COLORS.pred, { width: 1.5, dash: [5, 4], order: 10 }));

  const faint = s.phase === 'post' ? COLORS.faintPost : COLORS.faintPre;
  const sel = live ? null : selectedTrial();
  for (const t of phase.trials) {
    if (!t.included || t === sel) continue;
    const p = curvePoints(t.curve, t.m);
    fvSets.push(line(`Trial ${t.number}`, p.fv, faint, { width: 1, order: 5 }));
    vtSets.push(line(`Trial ${t.number}`, p.vt, faint, { width: 1, order: 5 }));
  }
  // Show the other phase's best Trial for Pre/Post comparison.
  const other = s.phase === 'post' ? s.session.pre : s.session.post;
  const otherBest = other?.trials.find((t) => t.id === other.eval.bestTrialId);
  if (otherBest) {
    const p = curvePoints(otherBest.curve, otherBest.m);
    const c = s.phase === 'post' ? COLORS.pre : COLORS.post;
    const lbl = s.phase === 'post' ? 'Pre best' : 'Post best';
    fvSets.push(line(lbl, p.fv, c, { width: 1.8, order: 3 }));
    vtSets.push(line(lbl, p.vt, c, { width: 1.8, order: 3 }));
  }

  const color = s.phase === 'post' ? COLORS.post : COLORS.pre;
  let annotations = {};
  let note = '';
  if (live) {
    fvSets.push(line('Current Trial', live.pts.fv, live.color, { width: 2.8, order: 0 }));
    vtSets.push(line('Current Trial', live.pts.vt, live.color, { width: 2.8, order: 0 }));
  } else if (sel) {
    const p = curvePoints(sel.curve, sel.m);
    const lbl = `Trial ${sel.number}${sel.id === phase.eval.bestTrialId ? ' (best)' : ''}`;
    fvSets.push(line(lbl, p.fv, color, { width: 2.8, order: 0 }));
    vtSets.push(line(lbl, p.vt, color, { width: 2.8, order: 0 }));
    annotations = vtAnnotations(sel.m, color);
    note = `Showing ${lbl} of the ${s.phase === 'post' ? 'post-bronchodilator' : 'pre-bronchodilator'} phase. Click a row in the Trial list to view another Trial.`;
  } else {
    const prev = previewTrial();
    const p = curvePoints(prev.curve, prev.m);
    fvSets.push(line('Preview (ideal manoeuvre)', p.fv, color, { width: 2.2, dash: [2, 2], order: 0 }));
    vtSets.push(line('Preview (ideal manoeuvre)', p.vt, color, { width: 2.2, dash: [2, 2], order: 0 }));
    annotations = vtAnnotations(prev.m, color);
    note = 'Preview of an ideal manoeuvre for the current physiology — it updates live as you move the sliders. Press “Run Trial” to coach the Subject through real Trials.';
  }
  const fixed = live ? fixedBounds(pred) : {};
  setData(fvChart, fvSets, { kind: 'fv', fixed });
  setData(vtChart, vtSets, { kind: 'vt', annotations, fixed: live ? { xMax: Math.max(10, Math.ceil(live.pts.vt.at(-1)?.x ?? 0) + 1), yMax: fixed.vtY } : {} });
  if (!live) $('#sim-chart-note', root).textContent = note;
}

/** Keep axes still during animation so the curve grows into a stable frame. */
function fixedBounds(pred) {
  const phase = currentPhase();
  let maxF = pred.m.PEF;
  let maxV = pred.m.FVC;
  let minF = -pred.m.PIF;
  for (const t of phase.trials) {
    maxF = Math.max(maxF, t.m.PEF);
    maxV = Math.max(maxV, t.m.FVC);
    minF = Math.min(minF, -t.m.PIF);
  }
  return { xMax: Math.ceil(maxV + 0.6), yMax: 2 * Math.ceil((maxF + 0.8) / 2), yMin: -2 * Math.ceil((-minF + 0.5) / 2), vtY: Math.ceil(maxV + 0.6) };
}

function renderSession() {
  if (!root) return;
  const s = store.state;
  const phase = currentPhase();
  $$('#sim-phase button', root).forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.phase === s.phase));
    b.disabled = b.dataset.phase === 'post' && !s.session.post;
  });
  $('#btn-run', root).disabled = phase.trials.length >= MAX_TRIALS;
  $('#btn-auto', root).disabled = phase.trials.length >= MAX_TRIALS || phase.eval.sessionComplete;
  $('#btn-bd', root).disabled = !!s.session.post || s.session.pre.trials.length === 0;
  $('#btn-bd', root).title = s.session.pre.trials.length === 0 ? 'Run the Pre phase first' : 'Salbutamol 400 µg via spacer, wait 15 minutes';
  $('#sim-ref-label', root).textContent = REFERENCE_SETS[s.refSet].label;
  drawCharts();
  renderTrials(phase);
  renderResults();
  renderVolumes();
}

function renderTrials(phase) {
  const s = store.state;
  const sel = selectedTrial();
  $('#sim-trial-count', root).textContent = `· ${s.phase === 'post' ? 'Post-BD' : 'Pre'} · ${phase.trials.length}/${MAX_TRIALS}`;
  const e = phase.eval;
  $('#sim-grades', root).innerHTML = phase.trials.length
    ? `<span>FEV₁ grade ${gradeTag(e.fev1Grade)}</span><span>FVC grade ${gradeTag(e.fvcGrade)}</span>
       <span class="text-slate-500">ΔFEV₁ ${e.fev1Diff == null ? '—' : (e.fev1Diff * 1000).toFixed(0) + ' mL'} · ΔFVC ${e.fvcDiff == null ? '—' : (e.fvcDiff * 1000).toFixed(0) + ' mL'}</span>
       ${e.sessionComplete ? '<span class="tag-ok">Session complete (≥3 acceptable, repeatable)</span>' : ''}`
    : '';
  if (!phase.trials.length) {
    $('#sim-trials', root).innerHTML = `<tbody><tr><td class="py-6 text-center text-sm text-slate-500">No Trials yet in this phase. Press <b>Run Trial</b> (coached, animated) or <b>Auto Session</b>.</td></tr></tbody>`;
    $('#sim-trial-detail', root).innerHTML = '';
    return;
  }
  const rows = phase.trials.map((t) => {
    const best = t.id === e.bestTrialId;
    const issues = t.qc.reasons.length ? t.qc.reasons.join('; ') : '—';
    return `<tr data-trial="${t.id}" class="cursor-pointer ${t === sel ? 'bg-indigo-50' : 'hover:bg-slate-50'} ${t.included ? '' : 'opacity-50'}">
      <td class="font-semibold">${t.number}${best ? ' <span class="tag-std">best</span>' : ''}</td>
      <td class="num">${fmt(t.m.FEV1)}</td><td class="num">${fmt(t.m.FVC)}</td>
      <td class="num">${fmt(t.m.FEV1FVC * 100, 0)}</td><td class="num">${fmt(t.m.PEF, 1)}</td>
      <td class="num">${fmt(t.m.FET, 1)}</td><td class="num">${fmt(t.m.BEV * 1000, 0)}</td>
      <td>${statusTag(t.qc.fev1)}</td><td>${statusTag(t.qc.fvc)}</td>
      <td class="max-w-56 text-xs text-slate-600">${escapeHtml(issues)}</td>
      <td class="text-center"><input type="checkbox" data-include="${t.id}" ${t.included ? 'checked' : ''} aria-label="Include Trial ${t.number}" /></td>
    </tr>`;
  });
  $('#sim-trials', root).innerHTML = `<thead><tr>
      <th>#</th><th class="num">FEV₁ L</th><th class="num">FVC L</th><th class="num">FEV₁/FVC %</th><th class="num">PEF L/s</th>
      <th class="num">FET s</th><th class="num">BEV mL</th><th>FEV₁</th><th>FVC</th><th>Issues</th><th class="text-center">Use</th>
    </tr></thead><tbody>${rows.join('')}</tbody>`;

  if (sel) {
    const art = sel.curve.artefacts.map((a) => ARTEFACT_LABELS[a]).join(', ');
    $('#sim-trial-detail', root).innerHTML = `
      <div class="rounded-lg border border-slate-200 p-3">
        <p class="mb-2 text-xs font-semibold text-slate-700">Trial ${sel.number} — ATS/ERS 2019 checks ${art ? `<span class="ml-2 font-normal text-slate-500">Technician observed: ${art}</span>` : ''}</p>
        <ul class="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          ${sel.qc.checks.map((c) => `<li class="flex gap-2"><span class="${c.ok ? 'text-emerald-600' : 'text-rose-600'} font-bold">${c.ok ? '✓' : '✗'}</span>
            <span><b>${c.label}</b> <span class="text-slate-400">(${c.affects})</span><br/><span class="text-slate-600">${c.detail}</span></span></li>`).join('')}
        </ul>
      </div>`;
  }
}

function renderResults() {
  const s = store.state;
  const pre = s.session.pre.eval.best;
  const post = s.session.post?.eval.best;
  let values = pre;
  let src = 'Pre-bronchodilator best values';
  if (!pre) {
    values = previewTrial().m;
    src = 'Preview — ideal manoeuvre (no Trials yet)';
  }
  $('#sim-results-src', root).textContent = src;
  const c = compareAll(values, s.subject, s.refSet);
  const cp = post ? compareAll(post, s.subject, s.refSet) : null;
  const head = `<thead><tr><th>Parameter</th><th>Unit</th><th class="num">Pred</th><th class="num">LLN</th>
    <th class="num">${pre ? 'Pre' : 'Preview'}</th><th class="num">%Pred</th><th class="num">z-score</th>
    ${cp ? '<th class="num">Post</th><th class="num">%Pred</th><th class="num">z-score</th><th class="num">%Chg</th>' : ''}</tr></thead>`;
  const rows = REPORT_PARAMS.map((p) => {
    const r = c[p.key];
    const unit = p.unit;
    const cells = `<td class="num">${fmtParam(p, r.pred)}</td><td class="num">${fmtParam(p, r.lln)}</td>
      <td class="num font-semibold ${zClass(r.z)}">${fmtParam(p, r.measured)}</td>
      <td class="num">${fmt(r.pctPred, 0)}</td><td class="num ${zClass(r.z)}">${fmt(r.z, 2)}</td>`;
    let postCells = '';
    if (cp) {
      const q = cp[p.key];
      const chg = r.measured && q.measured != null && !['FET', 'BEV'].includes(p.key) ? ((q.measured - r.measured) / r.measured) * 100 : null;
      postCells = `<td class="num font-semibold ${zClass(q.z)}">${fmtParam(p, q.measured)}</td><td class="num">${fmt(q.pctPred, 0)}</td>
        <td class="num ${zClass(q.z)}">${fmt(q.z, 2)}</td><td class="num">${chg == null ? '—' : (chg >= 0 ? '+' : '') + chg.toFixed(0)}</td>`;
    }
    return `<tr><td class="font-medium">${p.label}</td><td class="text-xs text-slate-500">${unit}</td>${cells}${postCells}</tr>`;
  });
  $('#sim-results', root).innerHTML = head + `<tbody>${rows.join('')}</tbody>`;

  const quick = $('#sim-quick', root);
  if (pre) {
    const r = interpretSession(s.session, { refSet: s.refSet, standard: s.standard, ratioMethod: s.ratioMethod });
    quick.innerHTML = `<div class="callout-std flex flex-wrap items-center gap-2">
      <span><b>Quick interpretation</b> (${s.standard === 'legacy' ? 'Legacy' : 'ERS/ATS 2022'}): ${escapeHtml(r.summary)}</span>
      <button class="btn-ghost ml-auto px-2 py-1 text-xs" data-goto="trainer">Step-by-step →</button>
      <button class="btn-ghost px-2 py-1 text-xs" data-goto="report">View report →</button></div>`;
    $$('[data-goto]', quick).forEach((b) =>
      b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('pft:navigate', { detail: b.dataset.goto }))));
  } else {
    quick.innerHTML = '';
  }
}

function renderVolumes() {
  const s = store.state;
  const mech = s.session.pre.mech;
  const b = mech.basis;
  const rows = [
    ['TLC', b.tlc, mech.tlc],
    ['VC', b.fvc, mech.vc],
    ['RV', b.rv, mech.rv],
    ['RV/TLC (%)', (b.rv / b.tlc) * 100, (mech.rv / mech.tlc) * 100],
  ];
  const max = Math.max(b.tlc, mech.tlc);
  const bar = (tlc, rv) => {
    const w = (tlc / max) * 100;
    const rvW = (rv / tlc) * 100;
    return `<div class="h-5 rounded bg-slate-100" style="width:${w}%"><div class="flex h-full overflow-hidden rounded">
      <div class="h-full bg-indigo-400" style="width:${100 - rvW}%" title="VC"></div>
      <div class="h-full bg-slate-400" style="width:${rvW}%" title="RV"></div></div></div>`;
  };
  $('#sim-volumes', root).innerHTML = `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <table class="tbl"><thead><tr><th></th><th class="num">Predicted</th><th class="num">Simulated</th></tr></thead>
      <tbody>${rows.map(([k, p, m]) => `<tr><td>${k}</td><td class="num">${fmt(p, k.includes('%') ? 0 : 2)}</td><td class="num">${fmt(m, k.includes('%') ? 0 : 2)}</td></tr>`).join('')}</tbody></table>
      <div class="space-y-2 text-xs">
        <div><p class="mb-1 text-slate-500">Predicted</p>${bar(b.tlc, b.rv)}</div>
        <div><p class="mb-1 text-slate-500">Simulated</p>${bar(mech.tlc, mech.rv)}</div>
        <p class="text-slate-500"><span class="inline-block h-2 w-3 rounded-sm bg-indigo-400"></span> VC (spirometry) <span class="ml-2 inline-block h-2 w-3 rounded-sm bg-slate-400"></span> RV (needs body box / gas dilution)</p>
      </div>
    </div>
    <p class="callout-warn mt-3 text-xs">TLC, RV and FRC cannot be measured by spirometry. These values are illustrative (not GLI) to show why a low FVC needs plethysmography or gas dilution to confirm restriction, and how hyperinflation raises RV/TLC in emphysema.</p>`;
}
