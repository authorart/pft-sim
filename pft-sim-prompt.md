# Role & Objective
You are a senior clinical pulmonologist and expert full-stack medical education web developer. Your objective is to build a complete, self-contained, responsive, and visually polished interactive web application (single-page or clean tabbed architecture) designed to teach medical students, internal medicine residents, and pulmonary fellows the fundamentals, technique, physiological modeling, and interpretation of Pulmonary Function Tests (PFT), specifically Spirometry.

---

## Technical Stack & Design System
- **Framework/Languages**: Clean modern HTML5, CSS3 (using Tailwind CSS via CDN), and vanilla JavaScript (modular ES6).
- **Charting Engine**: Chart.js (with annotation plugin) or Canvas API for real-time, smooth parametric mathematical curve rendering of:
  1. Volume-Time Curve ($V$ vs. $t$).
  2. Flow-Volume Loop ($\dot{V}$ vs. $V$).
- **UI/UX Aesthetics**: Clean clinical aesthetic (slate/indigo/sky palette), tabbed navigation, responsive on tablets and desktops, accessible typography, with clear medical callouts (e.g., standard ATS/ERS criteria tags).

---

## Application Structure & Content Modules

### Tab 1: Lung Volumes & Capacities Fundamentals
- Interactive subdivisions of lung volumes:
  - Dynamic interactive diagram illustrating: TV (Tidal Volume), IRV, ERV, RV (Residual Volume), TLC (Total Lung Capacity), FVC/VC (Vital Capacity), FRC (Functional Residual Capacity), and IC (Inspiratory Capacity).
  - Clear clinical toggle indicating which volumes/capacities **can be measured via Spirometry** (TV, IRV, ERV, VC, IC) versus those requiring Plethysmography or Gas Dilution (RV, FRC, TLC).

### Tab 2: Clinical Basics, Indications & Preparation
- **Definition & Core Parameters**: $FEV_1$, $FVC$, $FEV_1/FVC$ ratio, $FEF_{25-75\%}$, $PEF$.
- **Indications**: Diagnostic (unexplained dyspnea, wheezing, chronic cough), Monitoring (COPD/Asthma response, interstitial disease, drug toxicity), Disability/Pre-operative evaluation.
- **Contraindications (ATS/ERS 2019)**:
  - Increased intrathoracic/abdominal pressure (e.g., thoracic/abdominal aortic aneurysm, recent eye/abdominal surgery within weeks, recent pneumothorax).
  - Increased myocardial demand/instability (recent MI or unstable angina < 1 month, severe PE).
  - Infection control risks.
- **Patient Preparation & Withholding Times**:
  - SABA (albuterol): withhold 4–6 hours.
  - SAMA (ipratropium): withhold 12 hours.
  - LABA/LAMA: withhold 24–48 hours (depending on duration: 24h for formoterol/salmeterol, 36–48h for tiotropium/vilanterol).
  - Avoid heavy exercise, smoking/vaping (≥1h), alcohol (≥8h), large meals (≥2h), tight clothing.

### Tab 3: Execution Method & Quality Control (ATS/ERS 2019 Standards)
- **3-Phase Technique**:
  1. Maximal inspiration (rapid and full to TLC).
  2. Blast out (forced exhalation with no hesitation; back-extrapolated volume $EV < 0.100\text{ L}$ or $5\%$ of FVC).
  3. Sustained effort (minimum 6 seconds in adults, or plateau defined as $\Delta V < 0.025\text{ L}$ for $\ge 1\text{ second}$).
- **Acceptability & Repeatability Criteria**:
  - Repeatability: Difference between the largest two $FVC$ values $\le 0.150\text{ L}$ and between the largest two $FEV_1$ values $\le 0.150\text{ L}$.
  - Usability grading (Grade A to E/U).

### Tab 4: Interactive Spirometry Simulator (Core Engine)
Provide an intuitive dual-panel layout:
1. **Control & Parameter Panel**:
   - **Demographic Inputs**: Age (18–90), Biological Sex (Male/Female), Height (130–210 cm), Race/Ethnicity (GLI 2012 Reference Equations toggle or reference factor).
   - **Baseline Reference Calculation Engine**:
     - Compute Predicted $FVC$, Predicted $FEV_1$, Predicted $FEV_1/FVC$, and Lower Limit of Normal (LLN, $z\text{-score} = -1.645$).
   - **Pathophysiological Preset Selector (Dropdown / Fast-Select Chips)**:
     1. Normal Baseline.
     2. Mild/Moderate Asthma (Obstructive, concave expiratory flow limb, scoop-out).
     3. Asthma Post-Bronchodilator (Positive response: $\ge 12\%$ and $\ge 200\text{ mL}$ increase in $FEV_1$ or $FVC$).
     4. Severe COPD / Emphysema (Severe obstruction, profound expiratory scoop, hyperinflation effect, reduced $FEV_1/FVC < \text{LLN}$).
     5. Idiopathic Pulmonary Fibrosis (IPF) / Parenchymal Restriction (Witch’s hat appearance: preserved peak flow, steep descent, symmetrically narrow loop, $FEV_1/FVC \ge \text{normal}$, low $FVC$).
     6. Extrathoracic / Chest Wall Restriction (Kyphoscoliosis / Obesity / Neuromuscular: low volumes with blunt peak flow).
     7. Fixed Central Airway Obstruction (Tracheal stenosis, goiter: flattened expiratory AND inspiratory loops).
     8. Variable Extrathoracic Obstruction (Vocal cord paralysis/dysfunction: flattened inspiratory loop, preserved expiratory loop).
     9. Variable Intrathoracic Obstruction (Tracheomalacia, lower tracheal mass: flattened expiratory plateau, preserved inspiratory loop).
     10. Submaximal / Poor Effort Artifact (Slow start, cough in first second, early termination < 3 seconds).
   - **Manual Sliders (Overrides)**: Effort level (%), Airway Resistance factor ($R_{aw}$), Lung Recoil/Elasticity factor ($E_{st}$).

2. **Real-time Dual Display**:
   - **Graph 1: Flow-Volume Loop**:
     - X-axis: Volume ($\text{L}$, from 0 to TLC/FVC).
     - Y-axis: Flow ($\text{L/s}$, positive expiratory above baseline, negative inspiratory below baseline).
     - Overlay **Predicted Normal Curve** (faint gray/dashed line) vs. **Simulated Measured Curve** (bold primary color line).
   - **Graph 2: Volume-Time Curve**:
     - X-axis: Time (0 to 10 seconds).
     - Y-axis: Volume ($\text{L}$).
     - Shows dynamic markers at 1 second ($FEV_1$) and plateau ($FVC$).
   - **Numerical Results Table**:
     - Columns: Parameter ($FEV_1$, $FVC$, $FEV_1/FVC\%$, $PEF$, $FEF_{25-75\%}$), Predicted Value, LLN Value, Measured Value, % Predicted, and $z$-score.

### Tab 5: Algorithmic Step-by-Step Interpretation Trainer
- Implement an automated ATS/ERS diagnostic flow algorithm:
  - **Step 1**: Check $FEV_1/FVC$ vs. LLN (or 0.70 fixed threshold toggle). If $< \text{LLN} \rightarrow$ **Obstructive Defect**.
  - **Step 2**: If Obstructive, grade severity based on $FEV_1$ % predicted:
    - $\ge 80\%$: Mild
    - $50–79\%$: Moderate
    - $30–49\%$: Severe
    - $< 30\%$: Very Severe
  - **Step 3**: Assess Bronchodilator Responsiveness ($\Delta FEV_1$ or $\Delta FVC \ge 12\%$ AND $\ge 200\text{ mL}$).
  - **Step 4**: If $FEV_1/FVC \ge \text{LLN}$ and $FVC < \text{LLN} \rightarrow$ **Suspected Restrictive Pattern** (Requires full lung volume measurement with Plethysmography/TLC for confirmation).
  - **Step 5**: Check Flow-Volume Loop morphology for upper airway obstruction patterns (Variable extrathoracic, Variable intrathoracic, Fixed).
- Include an interactive **"Interpret This Case"** mode where learners input their interpretation and receive immediate feedback.

---

## Mathematical Equations for Curve Generation
Ensure realistic parametric curves:
- **Expiratory Volume-Time**:
  $V(t) = FVC \cdot \left(1 - e^{-k \cdot t}\right)$ (adapted with multi-exponential rate constants to mimic biphasic emptying in COPD/Emphysema).
- **Flow-Volume Expiratory Limb**:
  $\dot{V}(V)$ rises quickly to $PEF$ in early volume ($15–20\%$ of FVC), then descends linearly in normal lungs, curvilinearly (concave/scooped) in obstruction, or steeply in restriction.
- **Inspiratory Limb**:
  Symmetric semi-elliptical curve reaching $PIF \approx 0.8 \times PEF$.

Deliver the full, runnable code with well-commented modules and clean separation of concerns.