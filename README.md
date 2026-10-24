# PFT Simulator — Spirometry

Interactive web application that teaches medical students, residents and pulmonary fellows how spirometry is performed, quality-controlled and interpreted.

**© 2026 Sirot Jantharaksa, MD. All rights reserved.** For medical education only — simulated data, not for clinical use.

## Sections

| Tab | Content |
|-----|---------|
| 1 · Lung Volumes | Interactive spirogram of volumes and capacities; which ones spirometry can measure; how disease changes them |
| 2 · Clinical Basics | Core parameters, indications, relative contraindications, withholding times, preparation (ATS/ERS 2019) |
| 3 · Technique & QC | Three-phase manoeuvre, back-extrapolation, acceptability/usability, repeatability, grades A–F/U, live error gallery |
| 4 · Simulator | Subject + GLI reference, 9 Presets, Effort/Raw/Est sliders, animated coached Trials, QC per Trial, Pre/Post bronchodilator, results with LLN and z-scores |
| 5 · Interpretation | Step-by-step ERS/ATS 2022 (or Legacy) algorithm on your Session, plus “Interpret This Case” quiz with graded feedback |
| 6 · Report | Vyntus SPIRO–style printable A4 report (Pre/Post table, z-score plot, graphs, quality, interpretation) |

## Standards

- **Reference equations:** GLI-2012 (5 ethnic groups, South-East Asian default) with a GLI Global (2023, race-neutral) toggle. LMS method; LLN = z −1.645. Validated against the LLN table in Stanojevic et al. 2022 (`tests/reference.test.js`).
- **Acquisition & QC:** ATS/ERS 2019 (Graham et al.) — BEV, EOFE, FIVC, cough; grades per Table 10; best values per the standard.
- **Interpretation:** ERS/ATS 2022 (Stanojevic et al.) — z-score severity, BDR > 10 % of predicted; Legacy toggle (ratio < LLN or < 0.70, FEV₁ %pred grades, ≥ 12 % and ≥ 200 mL).

Design decisions: [`docs/adr/`](docs/adr/). Vocabulary: [`GLOSSARY.md`](GLOSSARY.md). Work tracker: [`task.md`](task.md).

## Curve model

Expiration is simulated as multi-compartment lung emptying (`V(t) = Σ wᵢ·FVC·(1 − e^(−kᵢt))`) limited by an effort-dependent muscle drive, so PEF depends on effort while the late curve is effort-independent. Obstruction adds slow compartments (concave limb), stiff lungs raise the rate constants (steep, narrow loop), and upper-airway obstruction adds smooth flow ceilings. The inspiratory limb is semi-elliptical (PIF ≈ 0.8 × PEF). Static lung volumes (TLC, RV) are illustrative only.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest: GLI engine, Presets → expected interpretation
npm run build    # production build in dist/
```

Stack: Vite, vanilla ES modules, Tailwind CSS v4, Chart.js + chartjs-plugin-annotation. No backend.
