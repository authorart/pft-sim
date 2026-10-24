# PFT Simulator

An educational simulator that teaches spirometry technique, quality control and interpretation by generating realistic simulated test sessions and Vyntus-style reports.

## Language

### Testing

**Session**:
One simulated spirometry visit for one Subject, made of several Trials, optionally followed by a Post-bronchodilator phase.
_Avoid_: Test, visit, study

**Trial**:
A single forced expiratory/inspiratory manoeuvre within a Session.
_Avoid_: Blow, effort, attempt, curve

**Pre / Post**:
The two phases of a Session: before and after bronchodilator administration.
_Avoid_: Baseline (when meaning Pre), BD test

**Best value**:
The largest acceptable FEV₁ and the largest acceptable FVC across a phase's Trials, possibly taken from different Trials (ATS/ERS 2019).
_Avoid_: Max value, selected value

**Acceptability**:
Whether a single Trial meets ATS/ERS 2019 start, end and artefact criteria.

**Repeatability**:
Whether the two largest FEV₁ (and FVC) values within a phase differ by no more than 0.150 L.
_Avoid_: Reproducibility

**Grade**:
The ATS/ERS 2019 A–F (U) letter rating a phase's quality from Acceptability and Repeatability.
_Avoid_: Quality score

### Reference values

**Subject**:
The simulated person tested in a Session (age, sex, height, GLI ethnic group).
_Avoid_: Patient (except on the printed Report header), user

**Predicted**:
The GLI median value for a Subject's age, sex, height and ethnic group.
_Avoid_: Normal value, expected

**LLN**:
Lower limit of normal: the 5th percentile, i.e. z = −1.645.

**z-score**:
Number of standard deviations a measured value lies from Predicted, using the GLI LMS method.
_Avoid_: SD score

### Interpretation

**Pattern**:
The physiological classification of a Session's result from FEV₁/FVC and FVC: Normal, Obstruction, Possible restriction, Possible mixed, or Not interpretable.
_Avoid_: Diagnosis, defect

**Possible restriction**:
FEV₁/FVC at or above LLN with FVC (or FEV₁) below LLN; called the non-specific pattern, or PRISm when lung volumes are unavailable. Restriction itself requires TLC < LLN.
_Avoid_: Restrictive defect (from spirometry alone)

**Loop shape**:
The flow–volume morphology judgement for upper-airway obstruction: none, fixed, variable extrathoracic or variable intrathoracic. Assessed alongside, not instead of, the Pattern.
_Avoid_: UAO pattern

**Preset**:
A named disease scenario that seeds a Session's physiology (e.g. Severe COPD, IPF).
_Avoid_: Case, template, profile

**Bronchodilator responsiveness (BDR)**:
A change from Pre to Post in FEV₁ or FVC exceeding the threshold of the active Interpretation standard.
_Avoid_: Reversibility

**Interpretation standard**:
The rule set used for Patterns, severity and BDR: ERS/ATS 2022 (default) or Legacy (ATS/ERS 2005).

**Report**:
The printable Vyntus SPIRO–style summary of one Session.
_Avoid_: Printout, result sheet
