/**
 * Quality control per ATS/ERS 2019 (Graham et al., AJRCCM 2019; Tables 7 and 10).
 * FEV1 and FVC acceptability/usability are judged separately; Grades A–F/U per phase.
 */

export const REPEATABILITY_L = 0.15;

/** Acceptability limits that scale with FVC. */
export const bevLimit = (fvc) => Math.max(0.1, 0.05 * fvc);
export const fivcLimit = (fvc) => Math.max(0.1, 0.05 * fvc);

/**
 * Judge one Trial.
 * @param m          measurements (measure.js)
 * @param artefacts  technician-observed events from the manoeuvre (cough, …)
 * @param priorMaxFvc largest FVC among earlier Trials of the same phase (EOFE criterion 3)
 */
export function judgeTrial(m, artefacts, priorMaxFvc = null) {
  const checks = [];
  const add = (id, label, ok, detail, affects) => checks.push({ id, label, ok, detail, affects });

  const bevOk = m.BEV <= bevLimit(m.FVC);
  add('bev', 'Back-extrapolated volume', bevOk,
    `BEV ${(m.BEV * 1000).toFixed(0)} mL (limit ${(bevLimit(m.FVC) * 1000).toFixed(0)} mL = 5 % FVC or 100 mL)`, 'FEV1, FVC');

  const cough = artefacts.includes('cough');
  add('cough', 'No cough in first second', !cough, cough ? 'Cough within the first second of expiration' : 'No cough', 'FEV1');

  const plateau = m.lastSecondVolume < 0.025;
  const longFet = m.FET >= 15;
  const nearMax = priorMaxFvc != null && m.FVC >= priorMaxFvc - REPEATABILITY_L;
  const eofe = plateau || longFet || nearMax;
  let eofeDetail;
  if (plateau) eofeDetail = `Plateau: ${(m.lastSecondVolume * 1000).toFixed(0)} mL in last 1 s (< 25 mL)`;
  else if (longFet) eofeDetail = `FET ${m.FET.toFixed(1)} s ≥ 15 s`;
  else if (nearMax) eofeDetail = 'FVC within 150 mL of / above the largest prior FVC';
  else eofeDetail = `No plateau (${(m.lastSecondVolume * 1000).toFixed(0)} mL in last 1 s), FET ${m.FET.toFixed(1)} s`;
  add('eofe', 'End of forced expiration (EOFE)', eofe, eofeDetail, 'FVC');

  const fivcOk = m.FIVC - m.FVC <= fivcLimit(m.FVC);
  add('fivc', 'Maximal inspiration (FIVC − FVC)', fivcOk,
    `FIVC − FVC = ${((m.FIVC - m.FVC) * 1000).toFixed(0)} mL (limit ${(fivcLimit(m.FVC) * 1000).toFixed(0)} mL)`, 'FEV1, FVC');

  const fev1Acceptable = bevOk && !cough && fivcOk;
  const fvcAcceptable = bevOk && eofe && fivcOk;
  // Usability (Table 7): BEV and no glottic closure/cough in the first second for FEV1; BEV for FVC.
  const fev1Usable = bevOk && !cough;
  const fvcUsable = bevOk;

  return {
    checks,
    fev1: fev1Acceptable ? 'acceptable' : fev1Usable ? 'usable' : 'unusable',
    fvc: fvcAcceptable ? 'acceptable' : fvcUsable ? 'usable' : 'unusable',
    reasons: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

/** ATS/ERS 2019 Table 10 grade for one index (FEV1 or FVC) in one phase. */
export function gradeIndex(acceptableValues, usableCount) {
  const v = [...acceptableValues].sort((a, b) => b - a);
  if (v.length === 0) return { grade: usableCount > 0 ? 'U' : 'F', diff: null };
  if (v.length === 1) return { grade: 'E', diff: null };
  const diff = v[0] - v[1];
  let grade = 'E';
  if (v.length >= 3 && diff <= 0.15) grade = 'A';
  else if (diff <= 0.15) grade = 'B';
  else if (diff <= 0.2) grade = 'C';
  else if (diff <= 0.25) grade = 'D';
  return { grade, diff };
}

export const GRADE_TEXT = {
  A: '≥3 acceptable, two largest within 150 mL',
  B: '2 acceptable, within 150 mL',
  C: '≥2 acceptable, within 200 mL',
  D: '≥2 acceptable, within 250 mL',
  E: '≥2 acceptable > 250 mL apart, or only 1 acceptable',
  U: '0 acceptable, ≥1 usable',
  F: '0 acceptable and 0 usable',
};

/**
 * Evaluate a phase (Pre or Post): grades, repeatability and Best values.
 * Best FEV1 and FVC are the largest acceptable values (or largest usable if none acceptable),
 * possibly from different Trials. Flows come from the "best test" (largest FEV1 + FVC).
 */
export function evaluatePhase(trials) {
  const included = trials.filter((t) => t.included);
  const pick = (key, status) => included.filter((t) => t.qc[key.toLowerCase()] === status).map((t) => t.m[key]);
  const acc1 = pick('FEV1', 'acceptable');
  const accV = pick('FVC', 'acceptable');
  const use1 = pick('FEV1', 'usable');
  const useV = pick('FVC', 'usable');
  const g1 = gradeIndex(acc1, use1.length);
  const gV = gradeIndex(accV, useV.length);

  const largest = (arr) => (arr.length ? Math.max(...arr) : null);
  const fev1 = largest(acc1) ?? largest(use1);
  const fvc = largest(accV) ?? largest(useV);
  const candidates = included.filter((t) => t.qc.fev1 !== 'unusable' || t.qc.fvc !== 'unusable');
  const pool = candidates.filter((t) => t.qc.fev1 === 'acceptable' && t.qc.fvc === 'acceptable');
  const bestTrial = (pool.length ? pool : candidates).reduce(
    (best, t) => (!best || t.m.FEV1 + t.m.FVC > best.m.FEV1 + best.m.FVC ? t : best), null);

  let best = null;
  if (bestTrial && fev1 != null && fvc != null) {
    best = { ...bestTrial.m, FEV1: fev1, FVC: fvc, FEV1FVC: fev1 / fvc };
  }
  const repeatable = g1.diff != null && gV.diff != null && g1.diff <= REPEATABILITY_L && gV.diff <= REPEATABILITY_L;
  const acceptableBoth = included.filter((t) => t.qc.fev1 === 'acceptable' && t.qc.fvc === 'acceptable').length;
  return {
    fev1Grade: g1.grade,
    fvcGrade: gV.grade,
    fev1Diff: g1.diff,
    fvcDiff: gV.diff,
    repeatable,
    acceptableCount: acceptableBoth,
    sessionComplete: acc1.length >= 3 && accV.length >= 3 && repeatable,
    best,
    bestTrialId: bestTrial?.id ?? null,
  };
}
