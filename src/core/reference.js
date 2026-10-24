/**
 * Reference-equation engine (GLI LMS method).
 *
 * Implements the Global Lung Function Initiative LMS model:
 *   M (median)   = exp(a0 + a1·ln(height cm) + a2·ln(age) + ethnic terms + Mspline(age))
 *   S (CoV)      = exp(p0 + p1·ln(age) + ethnic terms + Sspline(age))
 *   L (skewness) = q0 + q1·ln(age) + Lspline(age)
 * Splines are tabulated every 0.25 y and linearly interpolated.
 *
 *   z   = ((measured / M)^L − 1) / (L · S)
 *   LLN = M · (1 + L · S · (−1.645))^(1/L)
 */
import gli2012 from '../data/gli2012.json';
import gliGlobal from '../data/gliGlobal.json';

export const Z_LLN = -1.645;

/** GLI-2012 ethnic groups, in the order of the a3..a6 / p2..p5 coefficients (index 0 = reference group). */
export const ETHNIC_GROUPS = [
  { id: 0, label: 'Caucasian' },
  { id: 1, label: 'African-American' },
  { id: 2, label: 'North-East Asian' },
  { id: 3, label: 'South-East Asian' },
  { id: 4, label: 'Other / Mixed' },
];

export const REFERENCE_SETS = {
  gli2012: { id: 'gli2012', label: 'GLI-2012', data: gli2012.params, ethnic: true },
  gliGlobal: { id: 'gliGlobal', label: 'GLI Global (2023, race-neutral)', data: gliGlobal.params, ethnic: false },
};

/** Parameters with GLI equations, mapped to their table keys. */
export const GLI_PARAMS = {
  FEV1: 'FEV1',
  FVC: 'FVC',
  FEV1FVC: 'FEV1FVC',
  FEF2575: 'FEF2575',
  FEF75: 'FEF75',
};

function interpolate(table, ageStart, step, age) {
  const pos = (age - ageStart) / step;
  const i = Math.max(0, Math.min(table.length - 1, Math.floor(pos)));
  const next = Math.min(table.length - 1, i + 1);
  const frac = Math.max(0, Math.min(1, pos - i));
  return table[i] + (table[next] - table[i]) * frac;
}

/**
 * L, M, S for one parameter, or null when the reference set has no equation for it
 * (e.g. FEF25-75 in GLI Global) or the age is outside the table.
 * @param {string} param  key of GLI_PARAMS
 * @param {{age:number, sex:'male'|'female', heightCm:number, ethnicity:number}} subject
 * @param {'gli2012'|'gliGlobal'} setId
 */
export function lms(param, subject, setId = 'gli2012') {
  const set = REFERENCE_SETS[setId];
  const eq = set?.data[GLI_PARAMS[param]]?.[subject.sex];
  if (!eq) return null;
  const { age, heightCm } = subject;
  const ageMax = eq.ageStart + (eq.M.length - 1) * eq.ageStep;
  if (age < eq.ageStart || age > ageMax) return null;

  const eth = set.ethnic ? subject.ethnicity ?? 0 : 0;
  const ethA = eth > 0 ? eq.a[2 + eth] : 0;
  const ethP = eth > 0 ? eq.p[1 + eth] : 0;
  const ms = interpolate(eq.M, eq.ageStart, eq.ageStep, age);
  const ss = interpolate(eq.S, eq.ageStart, eq.ageStep, age);
  const ls = interpolate(eq.L, eq.ageStart, eq.ageStep, age);

  const M = Math.exp(eq.a[0] + eq.a[1] * Math.log(heightCm) + eq.a[2] * Math.log(age) + ethA + ms);
  const S = Math.exp(eq.p[0] + eq.p[1] * Math.log(age) + ethP + ss);
  const L = eq.q[0] + eq.q[1] * Math.log(age) + ls;
  return { L, M, S };
}

/** Value at a given z-score. */
export function valueAtZ({ L, M, S }, z) {
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

/** z-score of a measured value. */
export function zScore({ L, M, S }, measured) {
  if (!(measured > 0)) return NaN;
  if (Math.abs(L) < 1e-9) return Math.log(measured / M) / S;
  return (Math.pow(measured / M, L) - 1) / (L * S);
}

/**
 * Predicted, LLN and ULN for one parameter.
 * @returns {{pred:number, lln:number, uln:number, lms:object} | null}
 */
export function reference(param, subject, setId = 'gli2012') {
  const p = lms(param, subject, setId);
  if (!p) return null;
  return { pred: p.M, lln: valueAtZ(p, Z_LLN), uln: valueAtZ(p, -Z_LLN), lms: p };
}

/** Full comparison of a measured value against reference. */
export function compare(param, subject, measured, setId = 'gli2012') {
  const ref = reference(param, subject, setId);
  if (!ref) return { pred: null, lln: null, uln: null, z: null, pctPred: null, belowLLN: null };
  const z = zScore(ref.lms, measured);
  return {
    pred: ref.pred,
    lln: ref.lln,
    uln: ref.uln,
    z,
    pctPred: (measured / ref.pred) * 100,
    belowLLN: z < Z_LLN,
  };
}
