/**
 * Tab 2 — Clinical basics: core parameters, indications, contraindications, preparation.
 * Content follows the ATS/ERS 2019 spirometry standard (Graham et al., AJRCCM 2019;200:e70–e88).
 */

const PARAMS = [
  { k: 'FEV₁', name: 'Forced expiratory volume in 1 s', unit: 'L',
    def: 'Volume exhaled in the first second of a forced expiration from TLC, timed from back-extrapolated time zero.',
    use: 'Main index of airflow limitation and of severity; tracks disease progression and treatment response.' },
  { k: 'FVC', name: 'Forced vital capacity', unit: 'L',
    def: 'Total volume exhaled forcefully and completely after a maximal inspiration.',
    use: 'Low FVC suggests restriction, but can also reflect gas trapping in obstruction or poor effort.' },
  { k: 'FEV₁/FVC', name: 'Ratio', unit: '%',
    def: 'Fraction of the vital capacity exhaled in the first second.',
    use: 'Defines obstruction when below the LLN (5th percentile). Falls with age, so a fixed 0.70 cut-off over-diagnoses the elderly.' },
  { k: 'FEF₂₅₋₇₅', name: 'Mid-expiratory flow', unit: 'L/s',
    def: 'Mean flow between 25 % and 75 % of FVC exhaled.',
    use: 'Sensitive to small-airway changes but highly variable; not used alone to diagnose obstruction.' },
  { k: 'PEF', name: 'Peak expiratory flow', unit: 'L/s',
    def: 'Maximal flow achieved, normally within ~0.1 s and the first 15–20 % of FVC.',
    use: 'Strongly effort-dependent; a blunted or flat peak suggests poor effort, weakness or upper-airway obstruction.' },
];

const EXTRA = [
  ['FET', 'Forced expiratory time — duration of expiration; ≥ 15 s satisfies the end-of-test criterion.'],
  ['BEV', 'Back-extrapolated volume — volume exhaled before time zero; must be < 5 % FVC or 100 mL.'],
  ['FIVC', 'Forced inspiratory vital capacity — if FIVC − FVC exceeds 100 mL / 5 %, the preceding inspiration was not maximal.'],
  ['PIF', 'Peak inspiratory flow — reduced with a flat inspiratory limb in extrathoracic obstruction.'],
  ['FEV₆', 'Volume at 6 s — a surrogate for FVC in some screening settings.'],
];

const INDICATIONS = {
  Diagnosis: [
    'Evaluate symptoms, signs or abnormal laboratory tests (dyspnoea, wheeze, chronic cough, abnormal imaging)',
    'Measure the physiological effect of disease',
    'Screen individuals at risk of lung disease (e.g. smokers)',
    'Assess pre-operative risk',
    'Assess prognosis',
  ],
  Monitoring: [
    'Response to therapy (asthma, COPD, interstitial lung disease)',
    'Disease progression',
    'Exacerbations and recovery',
    'Effects of occupational / environmental exposures',
    'Adverse reactions to drugs with pulmonary toxicity (amiodarone, methotrexate, bleomycin)',
  ],
  'Disability / impairment': [
    'Rehabilitation programme assessment',
    'Insurance evaluation',
    'Medico-legal assessment',
  ],
  Other: [
    'Research and clinical trials; epidemiological surveys',
    'Derivation of reference equations',
    'Pre-employment and lung-health monitoring for at-risk occupations',
    'Assessment before at-risk physical activities (e.g. diving)',
  ],
};

const CONTRA = {
  'Increased myocardial demand or blood-pressure changes': [
    'Acute myocardial infarction within 1 week',
    'Systemic hypotension or severe hypertension',
    'Significant atrial/ventricular arrhythmia',
    'Non-compensated heart failure',
    'Uncontrolled pulmonary hypertension; acute cor pulmonale',
    'Clinically unstable pulmonary embolism',
    'History of syncope related to forced expiration or cough',
  ],
  'Increased intracranial / intra-ocular pressure': [
    'Cerebral aneurysm',
    'Brain surgery within 4 weeks',
    'Recent concussion with continuing symptoms',
    'Eye surgery within 1 week',
  ],
  'Increased sinus / middle-ear pressure': ['Sinus or middle-ear surgery or infection within 1 week'],
  'Increased intrathoracic / intra-abdominal pressure': [
    'Pneumothorax',
    'Thoracic surgery within 4 weeks',
    'Abdominal surgery within 4 weeks',
    'Late-term pregnancy',
    'Thoracic or abdominal aortic aneurysm (clinical judgement)',
  ],
  'Infection control': [
    'Active or suspected transmissible respiratory/systemic infection, including tuberculosis',
    'Haemoptysis, significant secretions, oral lesions or bleeding',
  ],
};

const WITHHOLD = [
  ['SABA', 'salbutamol (albuterol)', '4–6 h'],
  ['SAMA', 'ipratropium bromide', '12 h'],
  ['LABA', 'formoterol, salmeterol', '24 h'],
  ['Ultra-LABA', 'indacaterol, vilanterol, olodaterol', '36 h'],
  ['LAMA', 'tiotropium, umeclidinium, aclidinium, glycopyrronium', '36–48 h'],
];

const AVOID = [
  ['Smoking, vaping or water-pipe use', '≥ 1 h', 'acute bronchoconstriction'],
  ['Intoxicants (alcohol)', '≥ 8 h', 'coordination and comprehension'],
  ['Vigorous exercise', '≥ 1 h', 'exercise-induced bronchoconstriction'],
  ['Tight clothing restricting chest/abdomen', 'on the day', 'external restriction'],
  ['Large meal', '≥ 2 h', 'diaphragm splinting (ATS/ERS 2005 advice)'],
];

const list = (items) => `<ul class="list-disc space-y-1 pl-5 text-sm text-slate-700">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

export function mount(el) {
  el.innerHTML = `
  <div class="mb-5">
    <h2 class="h2">Clinical Basics, Indications &amp; Preparation</h2>
    <p class="lead">What spirometry measures, when to order it, when to defer it and how to prepare the patient.</p>
  </div>

  <h3 class="h3 mb-3">Core parameters</h3>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
    ${PARAMS.map((p) => `
      <div class="card card-pad">
        <p class="text-xl font-bold text-indigo-700">${p.k}</p>
        <p class="text-xs font-medium text-slate-500">${p.name} · ${p.unit}</p>
        <p class="mt-2 text-sm text-slate-700">${p.def}</p>
        <p class="mt-2 text-xs text-slate-600"><b>Clinical use:</b> ${p.use}</p>
      </div>`).join('')}
  </div>
  <div class="card card-pad mt-4">
    <p class="card-title mb-2">Also reported</p>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      ${EXTRA.map(([k, d]) => `<div><dt class="inline font-semibold text-slate-800">${k}</dt> <dd class="inline text-slate-600">— ${d}</dd></div>`).join('')}
    </dl>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div class="card card-pad">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Indications</h3><span class="tag-std">ATS/ERS 2019 Table 1</span></div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        ${Object.entries(INDICATIONS).map(([g, items]) => `<div><p class="mb-1 text-sm font-semibold text-slate-800">${g}</p>${list(items)}</div>`).join('')}
      </div>
    </div>
    <div class="card card-pad">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Relative contraindications</h3><span class="tag-std">ATS/ERS 2019 Table 2</span></div>
      <div class="space-y-3">
        ${Object.entries(CONTRA).map(([g, items]) => `<div><p class="mb-1 text-sm font-semibold text-slate-800">${g}</p>${list(items)}</div>`).join('')}
      </div>
      <p class="callout-warn mt-3 text-xs">These are <b>relative</b>: the ordering clinician weighs risk against benefit. Stop the test if the patient has pain during the manoeuvre.</p>
    </div>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div class="card card-pad">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Bronchodilator withholding times</h3><span class="tag-std">ATS/ERS 2019 Table 8</span></div>
      <table class="tbl">
        <thead><tr><th>Class</th><th>Examples</th><th class="num">Withhold</th></tr></thead>
        <tbody>${WITHHOLD.map(([c, e, t]) => `<tr><td class="font-semibold">${c}</td><td class="text-slate-600">${e}</td><td class="num font-semibold">${t}</td></tr>`).join('')}</tbody>
      </table>
      <p class="mt-2 text-xs text-slate-500">With dual bronchodilators, use the longer withholding time. Withhold only when the question is diagnostic (e.g. bronchodilator responsiveness); to assess control on treatment, keep taking them and record the time of the last dose.</p>
    </div>
    <div class="card card-pad">
      <div class="mb-3 flex items-center justify-between"><h3 class="h3">Activities to avoid before testing</h3><span class="tag-std">ATS/ERS 2019 Table 5</span></div>
      <table class="tbl">
        <thead><tr><th>Avoid</th><th class="num">Before test</th><th>Why</th></tr></thead>
        <tbody>${AVOID.map(([a, t, w]) => `<tr><td class="font-medium">${a}</td><td class="num font-semibold">${t}</td><td class="text-xs text-slate-600">${w}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <div class="card card-pad">
      <h3 class="h3 mb-2">On the day</h3>
      ${list([
        'Confirm identity, age, birth sex and ethnicity; measure height and weight without shoes',
        'Ask about recent illness, medication timing and the activities above; note symptoms',
        'Seat the patient upright with feet flat, chin slightly elevated; use a noseclip',
        'Loosen tight clothing; dentures usually left in unless poorly fitting',
        'Explain and demonstrate the manoeuvre; coach vigorously throughout',
      ])}
    </div>
    <div class="card card-pad">
      <h3 class="h3 mb-2">Bronchodilator responsiveness test</h3>
      ${list([
        'After the pre-bronchodilator set, give <b>salbutamol 400 µg</b> (4 × 100 µg separate puffs via spacer)',
        'Wait <b>15 minutes</b> (30 minutes if ipratropium 160 µg is used)',
        'Repeat the forced manoeuvres to obtain a new acceptable, repeatable set',
        'ERS/ATS 2022: positive if FEV₁ or FVC increases by <b>&gt; 10 % of the predicted value</b>',
        'Legacy ATS/ERS 2005: ≥ 12 % <b>and</b> ≥ 200 mL from baseline',
      ])}
    </div>
  </div>`;
}
