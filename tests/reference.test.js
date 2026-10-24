import { describe, it, expect } from 'vitest';
import { reference, compare } from '../src/core/reference.js';

// LLN expressed as % predicted, GLI-2012 (ERS/ATS 2022 interpretation standard, Stanojevic et al., Table 3)
const TABLE3 = [
  { subject: { age: 25, sex: 'male', heightCm: 175 }, FEV1: 80.5, FVC: 80.9, FEV1FVC: 86.9 },
  { subject: { age: 25, sex: 'female', heightCm: 165 }, FEV1: 80.2, FVC: 79.9, FEV1FVC: 87.2 },
  { subject: { age: 80, sex: 'male', heightCm: 175 }, FEV1: 69.4, FVC: 72.0, FEV1FVC: 80.0 },
  { subject: { age: 80, sex: 'female', heightCm: 165 }, FEV1: 70.0, FVC: 70.0, FEV1FVC: 80.5 },
];

describe('GLI-2012 LMS engine', () => {
  for (const row of TABLE3) {
    const s = { ...row.subject, ethnicity: 0 };
    for (const p of ['FEV1', 'FVC', 'FEV1FVC']) {
      it(`LLN %pred ${p} ${s.sex} ${s.age}y ${s.heightCm}cm = ${row[p]}`, () => {
        const r = reference(p, s);
        // Published values are rounded; allow 0.75 percentage points.
        expect(Math.abs((r.lln / r.pred) * 100 - row[p])).toBeLessThan(0.75);
      });
    }
  }

  it('z-score at LLN is -1.645 and at predicted is 0', () => {
    const s = { age: 45, sex: 'female', heightCm: 158, ethnicity: 3 };
    const r = reference('FEV1', s);
    expect(compare('FEV1', s, r.lln).z).toBeCloseTo(-1.645, 6);
    expect(compare('FEV1', s, r.pred).z).toBeCloseTo(0, 6);
  });

  it('South-East Asian predicted is lower than Caucasian', () => {
    const base = { age: 40, sex: 'male', heightCm: 170 };
    expect(reference('FVC', { ...base, ethnicity: 3 }).pred).toBeLessThan(reference('FVC', { ...base, ethnicity: 0 }).pred);
  });

  it('GLI Global has FEV1/FVC but no FEF25-75', () => {
    const s = { age: 40, sex: 'male', heightCm: 170, ethnicity: 0 };
    expect(reference('FEV1FVC', s, 'gliGlobal')).not.toBeNull();
    expect(reference('FEF2575', s, 'gliGlobal')).toBeNull();
  });

  it('matches GLI-2012 predicted for 25 y Caucasian male 175 cm', () => {
    const s = { age: 25, sex: 'male', heightCm: 175, ethnicity: 0 };
    expect(reference('FEV1', s).pred).toBeCloseTo(4.47, 2);
    expect(reference('FVC', s).pred).toBeCloseTo(5.33, 2);
  });
});
