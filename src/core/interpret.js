/**
 * Interpretation algorithms.
 *  - ERS/ATS 2022 (Stanojevic et al., Eur Respir J 2022): LLN (z −1.645), z-score severity,
 *    BDR > 10 % of predicted.
 *  - Legacy: ratio < LLN or < 0.70 (toggle), FEV1 % predicted severity (GOLD-style grades used in
 *    the course brief), BDR ≥ 12 % and ≥ 200 mL from baseline (ATS/ERS 2005).
 */
import { compare, Z_LLN } from './reference.js';

/** Rows of the results table / Report; `gli` marks indices with a GLI equation. */
export const REPORT_PARAMS = [
  { key: 'FEV1', label: 'FEV₁', unit: 'L', gli: true, digits: 2 },
  { key: 'FVC', label: 'FVC', unit: 'L', gli: true, digits: 2 },
  { key: 'FEV1FVC', label: 'FEV₁/FVC', unit: '%', gli: true, digits: 1, pct: true },
  { key: 'PEF', label: 'PEF', unit: 'L/s', gli: false, digits: 2 },
  { key: 'FEF2575', label: 'FEF₂₅₋₇₅', unit: 'L/s', gli: true, digits: 2 },
  { key: 'FEF25', label: 'FEF₂₅', unit: 'L/s', gli: false, digits: 2 },
  { key: 'FEF50', label: 'FEF₅₀', unit: 'L/s', gli: false, digits: 2 },
  { key: 'FEF75', label: 'FEF₇₅', unit: 'L/s', gli: true, digits: 2 },
  { key: 'FEV6', label: 'FEV₆', unit: 'L', gli: false, digits: 2 },
  { key: 'FIVC', label: 'FIVC', unit: 'L', gli: false, digits: 2 },
  { key: 'PIF', label: 'PIF', unit: 'L/s', gli: false, digits: 2 },
  { key: 'FET', label: 'FET', unit: 's', gli: false, digits: 1 },
  { key: 'BEV', label: 'BEV', unit: 'mL', gli: false, digits: 0, scale: 1000 },
];

/** Measured vs reference for every row. */
export function compareAll(values, subject, refSet) {
  const out = {};
  for (const p of REPORT_PARAMS) {
    const measured = values?.[p.key];
    if (measured == null) {
      out[p.key] = { measured: null };
      continue;
    }
    out[p.key] = p.gli ? { measured, ...compare(p.key, subject, measured, refSet) } : { measured, pred: null, lln: null, z: null, pctPred: null };
  }
  return out;
}

export const STANDARDS = {
  ers2022: { id: 'ers2022', label: 'ERS/ATS 2022' },
  legacy: { id: 'legacy', label: 'Legacy (ATS/ERS 2005 · GOLD-style grades)' },
};

export const PATTERN_LABELS = {
  normal: 'Normal spirometry',
  obstruction: 'Obstruction',
  restriction: 'Possible restriction / non-specific pattern (PRISm)',
  mixed: 'Possible mixed disorder (obstruction + low FVC)',
  notInterpretable: 'Not interpretable — inadequate test quality',
};

export const UAO_LABELS = {
  none: 'No upper-airway obstruction pattern',
  fixed: 'Fixed upper-airway obstruction',
  veo: 'Variable extrathoracic obstruction',
  vio: 'Variable intrathoracic obstruction',
};

function severity2022(z) {
  if (z > Z_LLN) return 'mild'; // abnormal ratio with FEV1 still above LLN
  if (z >= -2.5) return 'mild';
  if (z >= -4) return 'moderate';
  return 'severe';
}

function severityLegacy(pct) {
  if (pct >= 80) return 'mild';
  if (pct >= 50) return 'moderate';
  if (pct >= 30) return 'severe';
  return 'very severe';
}

/** Flow–volume morphology for upper-airway obstruction (from the best Trial). */
export function detectUao(m) {
  if (!m) return 'none';
  const expFlat = m.expPlateau > 0.45;
  const inspFlat = m.inspPlateau > 0.6;
  if (expFlat && inspFlat) return 'fixed';
  if (inspFlat) return 'veo';
  if (expFlat) return 'vio';
  return 'none';
}

/** Bronchodilator responsiveness under the chosen standard. */
export function assessBdr(pre, post, subject, refSet, standard) {
  if (!pre || !post) return { tested: false };
  const dFev1 = post.FEV1 - pre.FEV1;
  const dFvc = post.FVC - pre.FVC;
  const predFev1 = compare('FEV1', subject, pre.FEV1, refSet).pred;
  const predFvc = compare('FVC', subject, pre.FVC, refSet).pred;
  const r = {
    tested: true,
    dFev1,
    dFvc,
    fev1PctPred: (dFev1 / predFev1) * 100,
    fvcPctPred: (dFvc / predFvc) * 100,
    fev1PctBase: (dFev1 / pre.FEV1) * 100,
    fvcPctBase: (dFvc / pre.FVC) * 100,
  };
  if (standard === 'legacy') {
    const f1 = r.fev1PctBase >= 12 && dFev1 >= 0.2;
    const fv = r.fvcPctBase >= 12 && dFvc >= 0.2;
    r.positive = f1 || fv;
    r.rule = 'ΔFEV₁ or ΔFVC ≥ 12 % of baseline AND ≥ 200 mL';
    r.which = [f1 && 'FEV₁', fv && 'FVC'].filter(Boolean);
  } else {
    const f1 = r.fev1PctPred > 10;
    const fv = r.fvcPctPred > 10;
    r.positive = f1 || fv;
    r.rule = 'ΔFEV₁ or ΔFVC > 10 % of the predicted value';
    r.which = [f1 && 'FEV₁', fv && 'FVC'].filter(Boolean);
  }
  return r;
}

/**
 * Step-by-step interpretation of a Session.
 * @param session  Session (session.js)
 * @param opts     { refSet, standard: 'ers2022'|'legacy', ratioMethod: 'lln'|'fixed' }
 */
export function interpretSession(session, { refSet = 'gli2012', standard = 'ers2022', ratioMethod = 'lln' } = {}) {
  const { subject } = session;
  const pre = session.pre.eval;
  const post = session.post?.eval;
  const best = pre.best;
  const steps = [];
  const legacy = standard === 'legacy';

  // Step 0 — quality
  const grades = `FEV₁ grade ${pre.fev1Grade}, FVC grade ${pre.fvcGrade}`;
  const notInterp = !best || pre.fev1Grade === 'F' || pre.fvcGrade === 'F' || (pre.fev1Grade === 'U' && pre.fvcGrade === 'U');
  const caution = !notInterp && ['D', 'E', 'U'].some((g) => g === pre.fev1Grade || g === pre.fvcGrade);
  steps.push({
    id: 'quality',
    title: 'Test quality (ATS/ERS 2019)',
    finding: notInterp ? 'Not interpretable' : caution ? 'Interpret with caution' : 'Adequate',
    status: notInterp ? 'abnormal' : caution ? 'warning' : 'normal',
    detail: `${grades}. Grades A–C are suitable for interpretation; D–E/U only with caution; F is not reportable.`,
  });
  if (notInterp) {
    return { steps, pattern: 'notInterpretable', severity: null, bdr: { tested: false }, uao: 'none', quality: { notInterp, caution }, summary: PATTERN_LABELS.notInterpretable + '. Repeat the test with coaching.' };
  }

  const c = compareAll(best, subject, refSet);
  const ratio = c.FEV1FVC;
  const fixedRatio = legacy && ratioMethod === 'fixed';
  const obstructed = fixedRatio ? best.FEV1FVC < 0.7 : ratio.belowLLN;
  steps.push({
    id: 'ratio',
    title: 'Step 1 — Is FEV₁/FVC reduced?',
    finding: obstructed ? 'Yes — airflow obstruction' : 'No',
    status: obstructed ? 'abnormal' : 'normal',
    detail: fixedRatio
      ? `FEV₁/FVC ${(best.FEV1FVC * 100).toFixed(0)} % vs fixed threshold 70 %.`
      : `FEV₁/FVC ${(best.FEV1FVC * 100).toFixed(0)} % vs LLN ${(ratio.lln * 100).toFixed(0)} % (z = ${ratio.z.toFixed(2)}).`,
  });

  const fvcLow = c.FVC.belowLLN;
  const fev1Low = c.FEV1.belowLLN;
  steps.push({
    id: 'fvc',
    title: 'Step 2 — Is FVC reduced?',
    finding: fvcLow ? 'Yes — FVC below LLN' : 'No',
    status: fvcLow ? 'abnormal' : 'normal',
    detail: `FVC ${best.FVC.toFixed(2)} L (${c.FVC.pctPred.toFixed(0)} % pred) vs LLN ${c.FVC.lln.toFixed(2)} L (z = ${c.FVC.z.toFixed(2)}).${
      fvcLow ? ' A low FVC needs lung volumes (TLC by plethysmography) to confirm restriction.' : ''}`,
  });

  let pattern;
  if (obstructed) pattern = fvcLow ? 'mixed' : 'obstruction';
  else pattern = fvcLow || fev1Low ? 'restriction' : 'normal';

  let severity = null;
  if (pattern !== 'normal') {
    severity = legacy ? severityLegacy(c.FEV1.pctPred) : severity2022(c.FEV1.z);
    steps.push({
      id: 'severity',
      title: 'Step 3 — Severity of impairment',
      finding: severity[0].toUpperCase() + severity.slice(1),
      status: 'abnormal',
      detail: legacy
        ? `FEV₁ ${c.FEV1.pctPred.toFixed(0)} % predicted (≥ 80 mild · 50–79 moderate · 30–49 severe · < 30 very severe).`
        : `FEV₁ z = ${c.FEV1.z.toFixed(2)} (−1.65 to −2.5 mild · −2.51 to −4 moderate · < −4 severe).`,
    });
  }

  const bdr = assessBdr(best, post?.best, subject, refSet, standard);
  steps.push({
    id: 'bdr',
    title: 'Step 4 — Bronchodilator responsiveness',
    finding: !bdr.tested ? 'Not tested' : bdr.positive ? `Positive (${bdr.which.join(' and ')})` : 'Not significant',
    status: !bdr.tested ? 'info' : bdr.positive ? 'abnormal' : 'normal',
    detail: !bdr.tested
      ? 'Give a bronchodilator and repeat the manoeuvres to assess responsiveness.'
      : legacy
        ? `ΔFEV₁ ${(bdr.dFev1 * 1000).toFixed(0)} mL (${bdr.fev1PctBase.toFixed(1)} % of baseline); ΔFVC ${(bdr.dFvc * 1000).toFixed(0)} mL (${bdr.fvcPctBase.toFixed(1)} %). Rule: ${bdr.rule}.`
        : `ΔFEV₁ ${(bdr.dFev1 * 1000).toFixed(0)} mL = ${bdr.fev1PctPred.toFixed(1)} % of predicted; ΔFVC ${(bdr.dFvc * 1000).toFixed(0)} mL = ${bdr.fvcPctPred.toFixed(1)} % of predicted. Rule: ${bdr.rule}.`,
  });

  const uao = detectUao(best);
  steps.push({
    id: 'uao',
    title: 'Step 5 — Flow–volume loop shape',
    finding: UAO_LABELS[uao],
    status: uao === 'none' ? 'normal' : 'abnormal',
    detail: `Empey index FEV₁(mL)/PEF(L/min) = ${best.empey.toFixed(1)} (> 10 suggests upper-airway obstruction); FEF₅₀/FIF₅₀ = ${(best.FEF50 / best.FIF50).toFixed(2)} (> 1 extrathoracic, < 0.3 intrathoracic).`,
  });

  const parts = [pattern === 'normal' && uao !== 'none' ? 'FEV₁/FVC and FVC within normal limits' : PATTERN_LABELS[pattern]];
  if (severity) parts[0] += ` — ${severity}`;
  if (bdr.tested) parts.push(bdr.positive ? 'significant bronchodilator response' : 'no significant bronchodilator response');
  if (uao !== 'none') parts.push(`flow–volume loop suggests ${UAO_LABELS[uao].toLowerCase()}`);
  if (pattern === 'restriction' || pattern === 'mixed') parts.push('recommend lung volumes (TLC) to confirm');
  if (caution) parts.push('interpret with caution (suboptimal test quality)');
  const summary = parts.join('; ') + '.';

  return { steps, pattern, severity, bdr, uao, quality: { notInterp, caution }, values: c, summary };
}
