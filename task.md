# PFT Simulator — Task Tracker

© 2026 Siro Jantharaksa, MD. All rights reserved.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## Decisions (from design grilling, 2026-10-24)

| # | Decision |
|---|----------|
| Q1 | GLI-2012, 5 ethnic groups, default **South-East Asian**; GLI Global (2023) toggle |
| Q2 | Interpretation: **ERS/ATS 2022** default (z-score severity, BDR > 10 % predicted, PRISm); **Legacy 2005** toggle side-by-side |
| Q3 | Vite + vanilla ES modules + Tailwind (build-time) + Chart.js & annotation plugin |
| Q4 | Sessions of 3–8 Trials with variability; Best values + A–F Grade per ATS/ERS 2019 |
| Q5 | Tab 6 "Report": Vyntus SPIRO–style A4, editable institution/patient fields, "SIMULATED – NOT FOR CLINICAL USE" watermark |
| Q6 | English UI |
| Q7 | "Interpret This Case": structured choices + step-by-step graded feedback, randomised cases |
| Q8 | Public GitHub repo `pft-sim`, All rights reserved, Vercel linked to GitHub (auto-deploy) |
| Q9 | Every Session may run Post; BD response size set by Preset |
| Q10 | Preset seeds sliders (Effort, Raw, Est); slider changes mark Preset "(modified)" |
| Q11 | Non-GLI parameters (PEF, FEF25, FEF50, FEV6, FIVC, PIF, FET, BEV) shown measured-only |
| Q12 | Lung volumes illustrative (Tab 1 textbook; simulator scales TLC/RV from FVC, labelled) |
| Q13 | Real-time Trial animation at 2× with skip, coaching cue, phase labels |
| Q14 | "Run Trial" (one at a time, max 8) + "Auto Session"; include/exclude Trials |

See also: [GLOSSARY.md](GLOSSARY.md), [docs/adr/](docs/adr/).

## Phase 0 — Setup
- [x] Scaffold Vite vanilla project, Tailwind, Chart.js + chartjs-plugin-annotation
- [x] Project structure (`src/core`, `src/ui`, `src/tabs`, `src/data`)
- [x] LICENSE (All rights reserved), README, footer copyright + disclaimer

## Phase 1 — Reference engine (`src/core/reference`)
- [x] Obtain GLI-2012 coefficients + spline lookup tables (M/S/L, ages 3–95) — FEV1, FVC, FEV1/FVC, FEF25-75, FEF75
- [x] Obtain GLI Global (2023) coefficients + splines
- [x] LMS engine: Predicted, LLN (z = −1.645), ULN, z-score, % predicted
- [x] Unit tests against published worked examples / GLI calculator values

## Phase 2 — Physiology & curve model (`src/core/model`)
- [x] Physiology parameters (Effort, Raw, Est + hidden shape params) and Preset definitions (10 → 9 Presets, asthma has strong BDR)
- [x] Expiratory flow-volume limb (rise to PEF at 15–20 % FVC; linear / concave / steep descent)
- [x] Volume-time (multi-exponential; biphasic in COPD) consistent with F-V limb
- [x] Inspiratory limb (semi-elliptical, PIF ≈ 0.8 PEF) and UAO flow caps (fixed / variable extra- / intrathoracic)
- [x] Effort artefacts: slow start (BEV), cough in first second, early termination
- [x] Trial-to-trial variability + Post-bronchodilator response per Preset
- [x] Derived measurements: FEV1, FVC, FEV1/FVC, PEF, FEF25/50/75, FEF25-75, FEV6, FIVC, PIF, FET, BEV
- [x] Illustrative TLC/RV/FRC scaling

## Phase 3 — Quality control (`src/core/qc`)
- [x] Acceptability per Trial (BEV, EOFE plateau / FET, cough, glottic closure) with reasons
- [x] Repeatability (≤ 0.150 L FEV1 & FVC)
- [x] Best value selection (from included Trials) + A–F/U Grade

## Phase 4 — Interpretation (`src/core/interpret`)
- [x] ERS/ATS 2022 algorithm (ratio < LLN, FVC < LLN, PRISm, mixed, z-score severity, BDR > 10 % predicted)
- [x] Legacy 2005 algorithm (% pred severity, ≥ 12 % & ≥ 200 mL BDR; 0.70 fixed-ratio toggle)
- [x] Flow-volume morphology → UAO pattern
- [x] Narrative interpretation text

## Phase 5 — UI shell
- [x] Layout, tabbed navigation, slate/indigo/sky theme, responsive (tablet/desktop)
- [x] Shared app state (Subject, Session, settings) + event bus

## Phase 6 — Tabs
- [x] Tab 1 Lung Volumes: interactive diagram, spirometry-measurable toggle
- [x] Tab 2 Clinical Basics: parameters, indications, contraindications (ATS/ERS 2019), preparation/withholding times
- [x] Tab 3 Technique & QC: 3-phase technique, acceptability/repeatability, grading table, live examples
- [x] Tab 4 Simulator: controls, Presets chips, sliders, F-V + V-T charts (predicted overlay), Trial list, results table, animation
- [x] Tab 5 Interpretation Trainer: algorithm walkthrough + "Interpret This Case" quiz
- [x] Tab 6 Report: Vyntus SPIRO–style A4, z-score bar plot, Pre/Post table, graphs, print/PDF

## Phase 7 — Verification
- [x] Unit tests (reference, QC, interpretation)
- [x] Each Preset produces its expected Pattern under both standards
- [x] Browser check of every tab (desktop + tablet widths) and print preview
- [x] Production build passes

## Phase 8 — Ship
- [ ] `git init`, commit, create public GitHub repo `pft-sim`, push
- [ ] Create Vercel project `pft-sim`, link to GitHub, deploy
- [ ] Verify live URL; record it here
