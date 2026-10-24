/**
 * Presets: named disease scenarios that seed a Session's physiology.
 *
 * Visible slider values (effort %, Raw factor, Est factor) are set by the Preset and
 * may then be overridden by the learner. Hidden shape parameters stay with the Preset.
 *
 *  hetero      extra airway heterogeneity (slow-compartment fraction) → concave "scooped" limb
 *  vcScale     vital-capacity scaling independent of recoil (chest wall / neuromuscular)
 *  muscle      maximal expiratory muscle drive (1 = normal) → blunted PEF when low
 *  expCap      expiratory flow ceiling as a fraction of predicted PEF (intrathoracic / fixed central obstruction)
 *  inspCap     inspiratory flow ceiling as a fraction of predicted PEF (extrathoracic / fixed central obstruction)
 *  inspFactor  PIF relative to 0.8 × normal PEF
 *  tlcScale    illustrative TLC scaling (body-box value the learner cannot measure here)
 *  reversibility  fraction of excess Raw relieved by bronchodilator (Post phase)
 *  technique   probability of each technical fault per Trial
 */
export const PRESETS = [
  {
    id: 'normal',
    label: 'Normal',
    short: 'Normal',
    expected: 'Normal spirometry',
    description: 'Healthy lungs. Rapid rise to a sharp PEF at ~15 % of FVC, then a near-linear descent. Plateau reached within a few seconds.',
    sliders: { effort: 100, raw: 1, est: 1 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: null, inspCap: null, inspFactor: 1, tlcScale: 1, reversibility: 0.5 },
    technique: { slowStart: 0.05, cough: 0.04, earlyTermination: 0.06, submaxInspiration: 0.04 },
  },
  {
    id: 'asthma',
    label: 'Asthma (mild–moderate)',
    short: 'Asthma',
    expected: 'Obstruction with positive bronchodilator response',
    description: 'Reversible airway narrowing. Reduced FEV₁/FVC with a concave (scooped) expiratory limb. Post-bronchodilator FEV₁ improves markedly.',
    sliders: { effort: 100, raw: 2.5, est: 1 },
    hidden: { hetero: 0.15, vcScale: 1, muscle: 1, expCap: null, inspCap: null, inspFactor: 1, tlcScale: 1.05, reversibility: 0.6 },
    technique: { slowStart: 0.04, cough: 0.1, earlyTermination: 0.06, submaxInspiration: 0.04 },
  },
  {
    id: 'copd',
    label: 'Severe COPD / Emphysema',
    short: 'COPD',
    expected: 'Severe obstruction (low FVC from gas trapping may flag "possible mixed"), no significant bronchodilator response',
    description: 'Loss of elastic recoil and dynamic airway collapse. Sharp, low PEF followed by a profound scoop; long expiratory time; hyperinflation (TLC ↑, RV ↑↑).',
    sliders: { effort: 100, raw: 2.8, est: 0.5 },
    hidden: { hetero: 0.15, vcScale: 1, muscle: 1, expCap: null, inspCap: null, inspFactor: 0.9, tlcScale: 1.1, reversibility: 0.1 },
    technique: { slowStart: 0.04, cough: 0.12, earlyTermination: 0.15, submaxInspiration: 0.05 },
  },
  {
    id: 'ipf',
    label: 'IPF / Parenchymal restriction',
    short: 'IPF',
    expected: 'Possible restriction (normal or high FEV₁/FVC, low FVC)',
    description: 'Stiff lungs (high elastic recoil). Small, narrow "witch\'s hat" loop: preserved peak flow relative to volume, steep linear descent, high FEV₁/FVC.',
    sliders: { effort: 100, raw: 0.9, est: 2.4 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: null, inspCap: null, inspFactor: 1, tlcScale: 0.68, reversibility: 0 },
    technique: { slowStart: 0.04, cough: 0.12, earlyTermination: 0.05, submaxInspiration: 0.04 },
  },
  {
    id: 'chestwall',
    label: 'Chest wall / Neuromuscular restriction',
    short: 'Chest wall',
    expected: 'Possible restriction / non-specific pattern with blunted PEF',
    description: 'Kyphoscoliosis, obesity or respiratory-muscle weakness. Lungs are normal but the bellows are weak or restricted: low volumes and a rounded, blunted peak.',
    sliders: { effort: 100, raw: 1, est: 1.15 },
    hidden: { hetero: 0, vcScale: 0.62, muscle: 0.5, expCap: null, inspCap: null, inspFactor: 0.65, tlcScale: 0.72, reversibility: 0 },
    technique: { slowStart: 0.08, cough: 0.04, earlyTermination: 0.08, submaxInspiration: 0.08 },
  },
  {
    id: 'fixedUao',
    label: 'Fixed central airway obstruction',
    short: 'Fixed UAO',
    expected: 'Fixed upper-airway obstruction (flattened expiratory and inspiratory limbs)',
    description: 'Tracheal stenosis or goitre. Lumen does not change with transmural pressure: both expiratory and inspiratory limbs are flattened into plateaus.',
    sliders: { effort: 100, raw: 1, est: 1 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: 0.32, inspCap: 0.3, inspFactor: 1, tlcScale: 1, reversibility: 0 },
    technique: { slowStart: 0.04, cough: 0.04, earlyTermination: 0.05, submaxInspiration: 0.04 },
  },
  {
    id: 'veo',
    label: 'Variable extrathoracic obstruction',
    short: 'Variable extrathoracic',
    expected: 'Variable extrathoracic obstruction (flattened inspiratory limb)',
    description: 'Vocal cord paralysis / dysfunction. Negative airway pressure on inspiration collapses the extrathoracic airway: inspiratory plateau, expiratory limb preserved.',
    sliders: { effort: 100, raw: 1, est: 1 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: null, inspCap: 0.22, inspFactor: 1, tlcScale: 1, reversibility: 0 },
    technique: { slowStart: 0.04, cough: 0.04, earlyTermination: 0.05, submaxInspiration: 0.04 },
  },
  {
    id: 'vio',
    label: 'Variable intrathoracic obstruction',
    short: 'Variable intrathoracic',
    expected: 'Variable intrathoracic obstruction (flattened expiratory limb)',
    description: 'Tracheomalacia or lower tracheal mass. Positive pleural pressure on forced expiration narrows the intrathoracic airway: expiratory plateau, inspiratory limb preserved.',
    sliders: { effort: 100, raw: 1, est: 1 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: 0.38, inspCap: null, inspFactor: 1, tlcScale: 1, reversibility: 0 },
    technique: { slowStart: 0.04, cough: 0.04, earlyTermination: 0.05, submaxInspiration: 0.04 },
  },
  {
    id: 'poorEffort',
    label: 'Submaximal / Poor effort artefact',
    short: 'Poor effort',
    expected: 'Unacceptable test — results not interpretable',
    description: 'Normal lungs, poor technique: slow start (large BEV), cough in the first second, early termination < 3 s and submaximal inspiration.',
    sliders: { effort: 55, raw: 1, est: 1 },
    hidden: { hetero: 0, vcScale: 1, muscle: 1, expCap: null, inspCap: null, inspFactor: 1, tlcScale: 1, reversibility: 0.5 },
    technique: { slowStart: 0.7, cough: 0.5, earlyTermination: 0.7, submaxInspiration: 0.5 },
  },
];

export const presetById = (id) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** Default physiology settings for a Preset. */
export function settingsFromPreset(id) {
  const p = presetById(id);
  return { presetId: p.id, ...p.sliders, modified: false };
}
