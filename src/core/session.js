/**
 * Session: one simulated spirometry visit — Pre phase Trials, optionally a Post phase.
 */
import { buildMechanics, simulateManoeuvre } from './model.js';
import { measure } from './measure.js';
import { judgeTrial, evaluatePhase } from './qc.js';
import { presetById } from './presets.js';
import { createRng } from './random.js';

export const MAX_TRIALS = 8;

export function createSession(subject, settings, seed = Math.floor(Math.random() * 2 ** 31)) {
  return {
    subject: { ...subject },
    settings: { ...settings },
    seed,
    createdAt: new Date().toISOString(),
    pre: newPhase(subject, settings, false),
    post: null,
  };
}

function newPhase(subject, settings, bd) {
  return { bd, mech: buildMechanics(subject, settings, { bd }), trials: [], eval: evaluatePhase([]) };
}

/** Technical-fault probabilities, worse when the effort slider is low. */
function faultOdds(settings) {
  const base = presetById(settings.presetId).technique;
  const poor = Math.max(0, (80 - settings.effort) / 80); // 0 at ≥ 80 % effort
  const scale = (p) => Math.min(0.85, p + poor * 0.5);
  return {
    slowStart: scale(base.slowStart),
    cough: base.cough,
    earlyTermination: scale(base.earlyTermination),
    submaxInspiration: scale(base.submaxInspiration),
  };
}

/** Generate the next Trial in a phase. */
export function runTrial(session, phaseKey = 'pre', { clean = false } = {}) {
  const phase = session[phaseKey];
  if (!phase || phase.trials.length >= MAX_TRIALS) return null;
  const index = phase.trials.length;
  const rng = createRng(session.seed + (phaseKey === 'post' ? 1000 : 0) + index * 7919);
  const odds = faultOdds(session.settings);
  // Learners see a mix: most Trials are good, faults appear at the Preset's rate.
  const fault = (p) => !clean && rng.chance(p);
  const manoeuvre = simulateManoeuvre(phase.mech, {
    rng,
    vcJitter: rng.normal(0, 0.012),
    kJitter: rng.normal(0, 0.03),
    driveJitter: rng.normal(0, 0.04),
    minBlow: rng.uniform(4, 7),
    maxTime: rng.chance(0.25) ? rng.uniform(12, 15) : 15.5,
    slowStart: fault(odds.slowStart),
    cough: fault(odds.cough),
    earlyTermination: fault(odds.earlyTermination),
    submaxInspiration: fault(odds.submaxInspiration),
  });
  const m = measure(manoeuvre);
  const priorMax = phase.trials.length ? Math.max(...phase.trials.map((t) => t.m.FVC)) : null;
  const trial = {
    id: `${phaseKey}-${index + 1}`,
    number: index + 1,
    phase: phaseKey,
    curve: manoeuvre,
    m,
    qc: judgeTrial(m, manoeuvre.artefacts, priorMax),
    included: true,
  };
  phase.trials.push(trial);
  phase.eval = evaluatePhase(phase.trials);
  return trial;
}

/** Run Trials until ≥ 3 acceptable and repeatable, or the 8-Trial maximum. */
export function autoRun(session, phaseKey = 'pre') {
  const phase = session[phaseKey];
  const added = [];
  while (phase.trials.length < MAX_TRIALS && !phase.eval.sessionComplete) {
    added.push(runTrial(session, phaseKey));
  }
  return added;
}

export function setTrialIncluded(session, phaseKey, trialId, included) {
  const phase = session[phaseKey];
  const t = phase?.trials.find((x) => x.id === trialId);
  if (!t) return;
  t.included = included;
  phase.eval = evaluatePhase(phase.trials);
}

export function giveBronchodilator(session) {
  if (!session.post) session.post = newPhase(session.subject, session.settings, true);
  return session.post;
}

/** Generate a complete Session in one go (used by the case trainer and the report demo). */
export function generateCompleteSession(subject, settings, { withPost = true, seed } = {}) {
  const s = createSession(subject, settings, seed);
  autoRun(s, 'pre');
  if (withPost) {
    giveBronchodilator(s);
    autoRun(s, 'post');
  }
  return s;
}
