/**
 * Derive spirometric indices from a simulated manoeuvre, using ATS/ERS 2019 conventions:
 * time zero by back-extrapolation from the steepest point of the volume–time curve.
 */

function interpAt(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] >= x) {
      const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1);
      return ys[i - 1] + f * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** Time at which exhaled volume first reaches v. */
function timeAtVolume(t, vol, v) {
  for (let i = 1; i < vol.length; i++) {
    if (vol[i] >= v) {
      const f = (v - vol[i - 1]) / (vol[i] - vol[i - 1] || 1);
      return t[i - 1] + f * (t[i] - t[i - 1]);
    }
  }
  return t[t.length - 1];
}

/** Flow when exhaled volume reaches v. */
function flowAtVolume(vol, flow, v) {
  for (let i = 1; i < vol.length; i++) {
    if (vol[i] >= v) {
      const f = (v - vol[i - 1]) / (vol[i] - vol[i - 1] || 1);
      return flow[i - 1] + f * (flow[i] - flow[i - 1]);
    }
  }
  return 0;
}

export function measure(m) {
  const { t, vol, flow } = m;
  // Steepest point of V–t = peak flow.
  let iPeak = 0;
  for (let i = 1; i < flow.length; i++) if (flow[i] > flow[iPeak]) iPeak = i;
  const pef = flow[iPeak];
  const t0 = t[iPeak] - vol[iPeak] / pef; // back-extrapolated time zero
  const bev = Math.max(0, interpAt(t, vol, Math.max(0, t0)));

  const endT = m.endTime;
  const fvc = vol[vol.length - 1];
  const fev1 = interpAt(t, vol, t0 + 1);
  const fev6 = t0 + 6 <= endT ? interpAt(t, vol, t0 + 6) : fvc;
  const fet = endT - t0;

  const t25 = timeAtVolume(t, vol, 0.25 * fvc);
  const t75 = timeAtVolume(t, vol, 0.75 * fvc);
  const fef2575 = (0.5 * fvc) / Math.max(0.01, t75 - t25);

  // Shape metrics for upper-airway obstruction: share of the limb spent near its peak (a plateau).
  let nearPeak = 0;
  let span = 0;
  for (let i = 1; i < vol.length && vol[i] <= 0.6 * fvc; i++) {
    const dv = vol[i] - vol[i - 1];
    span += dv;
    if (flow[i] >= 0.9 * pef) nearPeak += dv;
  }
  const insp = m.insp;
  const pif = insp.pif;
  let inspNear = 0;
  for (let i = 1; i < insp.vol.length; i++) if (-insp.flow[i] >= 0.9 * pif) inspNear += insp.vol[i - 1] - insp.vol[i];
  const fif50 = -insp.flow[Math.round((insp.flow.length - 1) / 2)];
  const fef50 = flowAtVolume(vol, flow, 0.5 * fvc);

  // Volume exhaled in the last 1 s of expiration (EOFE plateau criterion).
  const lastSecondVolume = fvc - interpAt(t, vol, endT - 1);

  return {
    FEV1: fev1,
    FVC: fvc,
    FEV1FVC: fev1 / fvc,
    PEF: pef,
    FEF25: flowAtVolume(vol, flow, 0.25 * fvc),
    FEF50: fef50,
    FEF75: flowAtVolume(vol, flow, 0.75 * fvc),
    FEF2575: fef2575,
    FEV6: fev6,
    FIVC: m.insp.fivc,
    PIF: m.insp.pif,
    FET: fet,
    BEV: bev,
    FIF50: fif50,
    timeToPef: t[iPeak] - t0,
    expPlateau: span > 0 ? nearPeak / span : 0,
    inspPlateau: insp.fivc > 0 ? inspNear / insp.fivc : 0,
    empey: (fev1 * 1000) / (pef * 60), // FEV1 (mL) / PEF (L/min); > 10 suggests upper-airway obstruction
    lastSecondVolume,
    t0,
  };
}
