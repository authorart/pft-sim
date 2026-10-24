/**
 * Shared application state with a tiny publish/subscribe store.
 * Tabs read `store.state` and re-render on the events they care about.
 */
import { settingsFromPreset } from './core/presets.js';
import { createSession } from './core/session.js';

const listeners = new Map();

const state = {
  subject: { age: 45, sex: 'male', heightCm: 170, weightKg: 65, ethnicity: 3 },
  refSet: 'gli2012',
  standard: 'ers2022',
  ratioMethod: 'lln',
  settings: settingsFromPreset('normal'),
  session: null,
  phase: 'pre',
  selectedTrialId: null,
  animate: true,
  speed: 2,
  report: {
    institution: 'PFT Simulator — Teaching Use Only',
    department: 'Pulmonary Function Laboratory',
    patientName: 'Simulated Patient',
    patientId: 'SIM-0001',
    operator: 'Trainee technician',
    physician: '',
    technicianComment: '',
    interpretation: '',
    interpretationEdited: false,
  },
};
state.session = createSession(state.subject, state.settings);

function emit(event) {
  for (const fn of listeners.get(event) ?? []) fn(state);
  for (const fn of listeners.get('*') ?? []) fn(state, event);
}

export const store = {
  state,
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
  emit,

  /** Subject or physiology changed → start a fresh Session. */
  resetSession() {
    state.session = createSession(state.subject, state.settings);
    state.phase = 'pre';
    state.selectedTrialId = null;
    state.report.interpretationEdited = false;
    emit('session');
  },
  setSubject(patch) {
    Object.assign(state.subject, patch);
    this.resetSession();
    emit('subject');
  },
  setSettings(patch, { fromPreset = false } = {}) {
    Object.assign(state.settings, patch);
    if (!fromPreset) state.settings.modified = true;
    this.resetSession();
    emit('settings');
  },
  setOption(key, value) {
    state[key] = value;
    emit('options');
  },
  /** Session content changed (trial added, included/excluded, Post phase). */
  touchSession() {
    if (!state.report.interpretationEdited) state.report.interpretation = '';
    emit('session');
  },
};
