import { describe, it, expect } from 'vitest';
import { PRESETS, settingsFromPreset } from '../src/core/presets.js';
import { generateCompleteSession } from '../src/core/session.js';
import { interpretSession } from '../src/core/interpret.js';

const SUBJECTS = [
  { age: 45, sex: 'male', heightCm: 170, ethnicity: 3 },
  { age: 68, sex: 'female', heightCm: 154, ethnicity: 3 },
  { age: 28, sex: 'male', heightCm: 182, ethnicity: 0 },
];

const EXPECT = {
  normal: (r) => r.pattern === 'normal' && r.uao === 'none' && !r.bdr.positive,
  asthma: (r) => r.pattern === 'obstruction' && r.bdr.positive,
  copd: (r) => ['obstruction', 'mixed'].includes(r.pattern) && !r.bdr.positive && ['moderate', 'severe', 'very severe'].includes(r.severity),
  ipf: (r) => r.pattern === 'restriction' && r.uao === 'none',
  chestwall: (r) => r.pattern === 'restriction',
  fixedUao: (r) => r.uao === 'fixed',
  veo: (r) => r.uao === 'veo',
  vio: (r) => r.uao === 'vio',
  poorEffort: (r) => r.pattern === 'notInterpretable' || r.quality.caution,
};

describe('each Preset yields its expected interpretation', () => {
  for (const preset of PRESETS) {
    for (const standard of ['ers2022', 'legacy']) {
      it(`${preset.id} (${standard})`, () => {
        let pass = 0;
        let total = 0;
        const fails = [];
        for (const subject of SUBJECTS) {
          for (let seed = 1; seed <= 12; seed++) {
            const s = generateCompleteSession(subject, settingsFromPreset(preset.id), { seed: seed * 101 });
            const r = interpretSession(s, { standard });
            total++;
            if (EXPECT[preset.id](r)) pass++;
            else fails.push(`${subject.age}${subject.sex[0]} seed${seed}: ${r.pattern}/${r.severity}/bdr=${r.bdr.positive}/uao=${r.uao} q=${s.pre.eval.fev1Grade}${s.pre.eval.fvcGrade}`);
          }
        }
        // Random technique faults may occasionally change the outcome; require ≥ 90 %.
        expect(pass / total, fails.slice(0, 5).join('\n')).toBeGreaterThanOrEqual(0.9);
      });
    }
  }

  it('normal sessions usually reach grade A within 8 trials', () => {
    let a = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = generateCompleteSession(SUBJECTS[0], settingsFromPreset('normal'), { seed, withPost: false });
      if (s.pre.eval.fev1Grade === 'A' && s.pre.eval.fvcGrade === 'A') a++;
    }
    expect(a).toBeGreaterThanOrEqual(25);
  });
});
