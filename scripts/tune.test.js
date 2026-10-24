// Tuning harness (not part of the test suite): prints measured indices per Preset.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildMechanics, simulateManoeuvre } from '../src/core/model.js';
import { measure } from '../src/core/measure.js';
import { compare } from '../src/core/reference.js';
import { PRESETS } from '../src/core/presets.js';

it('tune', () => {
  const subjects = [
    { age: 45, sex: 'male', heightCm: 170, ethnicity: 3 },
    { age: 65, sex: 'female', heightCm: 155, ethnicity: 3 },
  ];
  const lines = [];
  for (const s of subjects) {
    lines.push(`=== ${JSON.stringify(s)}`);
    for (const p of PRESETS) {
      for (const bd of [false, true]) {
        const mech = buildMechanics(s, { presetId: p.id, ...p.sliders }, { bd });
        const m = measure(simulateManoeuvre(mech, {}));
        const c = (k) => compare(k, s, m[k]);
        const f = (k) => { const r = c(k); return `${k} ${m[k].toFixed(2)} (${r.pctPred?.toFixed(0)}% z${r.z?.toFixed(1)})`; };
        lines.push(`${(p.id + (bd ? '+BD' : '')).padEnd(14)} ${f('FEV1')} ${f('FVC')} ${f('FEV1FVC')} PEF ${m.PEF.toFixed(1)}/${mech.basis.pef.toFixed(1)} ${f('FEF2575')} PIF ${m.PIF.toFixed(1)} FET ${m.FET.toFixed(1)} BEV ${m.BEV.toFixed(3)} tPEF ${m.timeToPef.toFixed(2)} last1s ${m.lastSecondVolume.toFixed(3)} expPl ${m.expPlateau.toFixed(2)} inPl ${m.inspPlateau.toFixed(2)} FEF50/FIF50 ${(m.FEF50/m.FIF50).toFixed(2)} Empey ${m.empey.toFixed(1)}`);
      }
    }
  }
  writeFileSync('scripts/tune.out.txt', lines.join('\n'));
});
