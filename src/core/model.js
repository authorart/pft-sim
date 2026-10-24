/**
 * Physiological curve model.
 *
 * The lung is modelled as parallel compartments emptying through the airways:
 *   peak compartment  (gas in central airways) — very fast, produces the sharp PEF
 *   fast compartment  (well-ventilated units)   — rate constant kFast
 *   slow compartment  (diseased, long time-constant units) — rate constant kSlow
 * The maximal expiratory flow envelope at any instant is  Fenv = Σ kᵢ·Vᵢ  (effort-independent).
 * Actual flow is the smaller of the envelope and the expiratory muscle drive
 *   D(t) = effort · muscle · Dmax · (1 − e^(−t/τrise))
 * so PEF is effort-dependent while the late part of the curve is effort-independent.
 * Integrating gives the volume–time curve; a single compartment gives
 *   V(t) = FVC·(1 − e^(−k·t))  → linear flow–volume descent,
 * multiple compartments give multi-exponential (biphasic) emptying → concave "scooped" limb.
 * Upper-airway obstruction adds smooth flow ceilings (plateaus).
 */
import { reference } from './reference.js';
import { presetById } from './presets.js';

const DT = 0.001; // integration step (s)
const SAMPLE_EVERY = 10; // record every 10 ms
const PLATEAU_VOLUME = 0.025; // L in the last 1 s (ATS/ERS 2019 EOFE)
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
// Central "peak" compartment: gas in large airways expelled in the first ~0.2 s, producing the sharp PEF.
const PEAK_W = 0.12;
const PEAK_K = 6;

/** Smooth minimum used for flow ceilings so plateaus have rounded shoulders. */
function softCap(flow, cap, n = 10) {
  if (cap == null || flow <= 0) return flow;
  return (flow * cap) / Math.pow(Math.pow(flow, n) + Math.pow(cap, n), 1 / n);
}

/** Predicted values the model needs (GLI-2012 drives the curve shape). */
export function predictedBasis(subject) {
  const fvc = reference('FVC', subject).pred;
  const ratio = reference('FEV1FVC', subject).pred;
  // Normal rate constant k0 such that the normal lung (peak + main compartment) reproduces the predicted FEV1/FVC.
  const normalRatio = (k) => PEAK_W * (1 - Math.exp(-PEAK_K * k)) + (1 - PEAK_W) * (1 - Math.exp(-k));
  let lo = 0.05;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normalRatio(mid) < ratio) lo = mid;
    else hi = mid;
  }
  const k0 = (lo + hi) / 2;
  // Envelope peak flow of the normal lung (stands in for predicted PEF; GLI has no PEF equation).
  const pef = fvc * k0 * (PEAK_W * PEAK_K + 1 - PEAK_W);
  // Illustrative static lung volumes (not GLI): RV/TLC rises with age.
  const rvTlc = clamp(0.2 + 0.0035 * (subject.age - 20), 0.18, 0.42);
  const tlc = fvc / (1 - rvTlc);
  return { fvc, ratio, k0, pef, tlc, rv: tlc - fvc, frc: tlc * (0.45 + 0.002 * (subject.age - 20)) };
}

/**
 * Convert slider settings + Preset hidden parameters into lung mechanics.
 * @param subject   Subject
 * @param settings  { presetId, effort (0–100), raw (≥0.5), est (0.3–3) }
 * @param bd        Post-bronchodilator: relieves part of the excess Raw / heterogeneity
 */
export function buildMechanics(subject, settings, { bd = false } = {}) {
  const preset = presetById(settings.presetId);
  const h = preset.hidden;
  const basis = predictedBasis(subject);
  const effort = clamp(settings.effort / 100, 0.2, 1);
  let raw = settings.raw;
  let hetero = h.hetero;
  if (bd) {
    // Normal airways still dilate slightly (~2–4 % FEV1).
    raw = 1 + (raw - 1) * (1 - h.reversibility) - 0.06 * h.reversibility;
    hetero *= 1 - h.reversibility;
  }
  raw = Math.max(0.5, raw);
  const est = clamp(settings.est, 0.3, 3);
  const lowRecoil = Math.max(0, 1 - est);

  // Vital capacity: stiff lungs shrink it; loss of recoil and airway closure trap gas (RV ↑).
  const recoilVc = est >= 1 ? Math.pow(est, -0.8) : 1 - 0.45 * lowRecoil;
  const trapVc = 1 - 0.07 * Math.max(0, raw - 1);
  const inspEffort = 0.8 + 0.2 * effort; // submaximal inspiration when effort is poor
  const vc = basis.fvc * h.vcScale * recoilVc * trapVc * inspEffort;

  // Rate constants: k = elastance / resistance.
  const kBase = (basis.k0 * Math.pow(est, 0.5)) / Math.pow(raw, 0.62);
  const slowFrac = clamp(hetero + 0.1 * Math.max(0, raw - 1) + 0.55 * lowRecoil, 0, 0.75);
  const kFast = kBase * (1 + 0.6 * slowFrac + 1.0 * lowRecoil);
  const kSlow = kBase / (1 + 2.5 * slowFrac + 3 * lowRecoil);
  const peakW = PEAK_W * (1 - 0.4 * slowFrac);
  const peakK = (PEAK_K * basis.k0 * Math.pow(est, 0.25)) / Math.pow(raw, 0.45);

  // Maximal expiratory drive: comfortably above the normal envelope peak, so normal PEF is envelope-limited.
  const dMax = 1.25 * basis.pef;
  const tlc = basis.tlc * h.tlcScale * (est < 1 ? 1 + 0.3 * lowRecoil : 1) * (1 + 0.04 * Math.max(0, raw - 1));
  // Upper-airway ceilings are expressed as a fraction of the subject's predicted PEF.
  const cap = (frac) => (frac == null ? null : frac * basis.pef);

  return {
    presetId: preset.id,
    vc,
    compartments: [
      { w: peakW, k: peakK },
      { w: (1 - peakW) * (1 - slowFrac), k: kFast },
      { w: (1 - peakW) * slowFrac, k: kSlow },
    ],
    drive: dMax * h.muscle,
    effort,
    riseTau: 0.035 / Math.pow(effort, 1.5) / Math.sqrt(h.muscle),
    expCap: cap(h.expCap),
    inspCap: cap(h.inspCap),
    pif: 0.8 * basis.pef * h.inspFactor * (0.55 + 0.45 * effort),
    tlc,
    rv: Math.max(0.6, tlc - vc),
    basis,
  };
}

/**
 * Simulate one forced manoeuvre.
 * @param mech  from buildMechanics()
 * @param opt   { vcJitter, kJitter, driveJitter, slowStart, cough, earlyTermination, submaxInspiration, minBlow, maxTime, rng }
 * @returns raw Trial curves: time series (t, vol, flow) for expiration and an inspiratory limb.
 */
export function simulateManoeuvre(mech, opt = {}) {
  const rng = opt.rng;
  const u = (a, b) => (rng ? rng.uniform(a, b) : (a + b) / 2);
  const artefacts = [];

  const inspDeficit = opt.submaxInspiration ? u(0.18, 0.45) : 0;
  if (opt.submaxInspiration) artefacts.push('submaxInspiration');
  const vcFull = mech.vc * (1 + (opt.vcJitter ?? 0));
  const vcStart = Math.max(0.3, vcFull - inspDeficit);

  const comps = mech.compartments.map((c) => ({ k: c.k * (1 + (opt.kJitter ?? 0)), v: c.w * vcStart }));
  let tau = mech.riseTau;
  let hesitation = 0;
  if (opt.slowStart) {
    tau = Math.max(tau, u(0.22, 0.4));
    hesitation = u(0.12, 0.3);
    artefacts.push('slowStart');
  }
  const coughAt = opt.cough ? u(0.25, 0.8) : null;
  if (opt.cough) artefacts.push('cough');
  const stopAt = opt.earlyTermination ? u(1.4, 2.8) : null;
  if (opt.earlyTermination) artefacts.push('earlyTermination');
  const maxTime = opt.maxTime ?? 15.5;
  const drive = mech.drive * mech.effort * (1 + (opt.driveJitter ?? 0));

  const t = [0];
  const vol = [0];
  const flow = [0];
  let V = 0;
  let time = 0;
  let step = 0;
  let endTime = maxTime;
  const history = [0]; // V sampled every 10 ms for plateau detection
  const minBlow = opt.minBlow ?? 5;
  let plateauAt = null;

  while (time < maxTime) {
    time += DT;
    step++;
    const env = comps.reduce((s, c) => s + c.k * c.v, 0);
    let f;
    if (time < hesitation) {
      f = Math.min(env, 0.25 + 0.6 * (time / hesitation)); // hesitant leak before the blast
    } else {
      const d = drive * (1 - Math.exp(-(time - hesitation) / tau));
      f = Math.min(env, d);
    }
    f = softCap(f, mech.expCap);
    if (coughAt != null) {
      if (time > coughAt && time < coughAt + 0.07) f *= 0.12;
      else if (time >= coughAt + 0.07 && time < coughAt + 0.15) f = Math.min(f * 1.7, env * 1.4 + 0.5);
    }
    if (stopAt != null && time > stopAt) f *= Math.exp(-(time - stopAt) / 0.04);
    f = Math.max(0, f);

    if (env > 0) {
      for (const c of comps) c.v = Math.max(0, c.v - f * DT * ((c.k * c.v) / env));
    }
    V += f * DT;

    if (step % SAMPLE_EVERY === 0) {
      t.push(+time.toFixed(3));
      vol.push(V);
      flow.push(f);
      history.push(V);
      // Coached subject keeps blowing until a plateau (< 25 mL over the last 1 s) is held, or 15 s.
      if (stopAt == null && plateauAt == null && time >= minBlow && history.length > 100) {
        const dv = V - history[history.length - 101];
        if (dv < PLATEAU_VOLUME * 0.8) plateauAt = time;
      }
      if (plateauAt != null && time >= plateauAt + 0.4) {
        endTime = time;
        break;
      }
      // Early termination: the subject comes off the mouthpiece shortly after stopping.
      if (stopAt != null && time > stopAt + 0.25) {
        endTime = time;
        break;
      }
    }
  }
  if (time >= maxTime) endTime = time;

  // Maximal inspiration from end-expiration back to TLC.
  const fvcRaw = V;
  const fivc = fvcRaw + inspDeficit; // inspires all the way back to (true) TLC
  const insp = inspiratoryLimb(mech, fvcRaw, fivc);

  return { t, vol, flow, endTime, artefacts, insp, inspDeficit };
}

/** Semi-elliptical inspiratory limb (PIF ≈ 0.8 × PEF), optionally capped. Volumes in exhaled-volume coordinates. */
export function inspiratoryLimb(mech, startVolume, fivc, n = 120) {
  const vol = [];
  const flow = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    let f = mech.pif * Math.pow(Math.sin(Math.PI * x), 0.62);
    f = softCap(f, mech.inspCap, 8);
    vol.push(startVolume - fivc * x);
    flow.push(-f);
  }
  return { vol, flow, fivc, pif: Math.max(...flow.map((f) => -f)) };
}

/** Noise-free predicted normal loop for the overlay. */
export function predictedLoop(subject) {
  const mech = buildMechanics(subject, { presetId: 'normal', effort: 100, raw: 1, est: 1 });
  return simulateManoeuvre(mech, {});
}
