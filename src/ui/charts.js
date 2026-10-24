/**
 * Chart.js wrappers for the flow–volume loop and the volume–time curve.
 * Curves are plotted as scatter datasets with lines (x numeric on both axes).
 */
import {
  Chart,
  ScatterController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(ScatterController, LineElement, PointElement, LinearScale, Tooltip, Legend, Filler, annotationPlugin);
Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
Chart.defaults.color = '#64748b';

export const COLORS = {
  pre: '#4f46e5',
  post: '#0284c7',
  pred: '#94a3b8',
  faintPre: 'rgba(79, 70, 229, 0.22)',
  faintPost: 'rgba(2, 132, 199, 0.25)',
  grid: '#e2e8f0',
  axis: '#94a3b8',
};

/**
 * Points of a manoeuvre revealed up to manoeuvre time `tShown` (animation).
 * Inspiration starts when expiration ends and takes ~1.2 s.
 */
export function curvePoints(curve, m, tShown = Infinity) {
  const fv = [];
  const vt = [];
  const { t, vol, flow } = curve;
  for (let i = 0; i < t.length; i++) {
    if (t[i] > tShown) break;
    fv.push({ x: vol[i], y: flow[i] });
    vt.push({ x: t[i] - m.t0, y: vol[i] });
  }
  if (tShown > curve.endTime) {
    const frac = Math.min(1, (tShown - curve.endTime) / 1.2);
    const n = Math.round(frac * (curve.insp.vol.length - 1));
    for (let i = 0; i <= n; i++) fv.push({ x: curve.insp.vol[i], y: curve.insp.flow[i] });
    if (frac >= 1) fv.push({ x: vol[0], y: 0 });
  }
  return { fv, vt };
}

const baseOptions = (compact) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  parsing: false,
  normalized: true,
  plugins: {
    legend: { display: !compact, position: 'bottom', labels: { boxWidth: 14, boxHeight: 2, font: { size: 11 } } },
    tooltip: {
      enabled: !compact,
      mode: 'nearest',
      intersect: false,
      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(2)}` },
    },
    annotation: { annotations: {} },
  },
  elements: { point: { radius: 0, hitRadius: 4 }, line: { tension: 0 } },
});

function axis(title, compact, extra = {}) {
  return {
    type: 'linear',
    title: { display: !compact, text: title, font: { size: 11, weight: '500' } },
    grid: { color: COLORS.grid },
    ticks: { font: { size: compact ? 9 : 11 } },
    ...extra,
  };
}

export function createFvChart(canvas, { compact = false } = {}) {
  const options = baseOptions(compact);
  options.scales = {
    x: axis('Volume (L)', compact, { min: 0 }),
    y: axis('Flow (L/s)', compact),
  };
  options.plugins.annotation.annotations.zero = { type: 'line', yMin: 0, yMax: 0, borderColor: COLORS.axis, borderWidth: 1 };
  return new Chart(canvas, { type: 'scatter', data: { datasets: [] }, options });
}

export function createVtChart(canvas, { compact = false } = {}) {
  const options = baseOptions(compact);
  options.scales = {
    x: axis('Time (s)', compact, { min: -1, max: 10 }),
    y: axis('Volume (L)', compact, { min: 0 }),
  };
  return new Chart(canvas, { type: 'scatter', data: { datasets: [] }, options });
}

/** Dataset helper. */
export function line(label, data, color, { width = 2, dash = [], fill = false, order = 0 } = {}) {
  return { label, data, borderColor: color, backgroundColor: color, borderWidth: width, borderDash: dash, showLine: true, pointRadius: 0, fill, order };
}

/** Set datasets and fit the axes to all data (with nice rounding). */
export function setData(chart, datasets, { kind, annotations = {}, fixed = {} } = {}) {
  chart.data.datasets = datasets;
  let xMax = 0;
  let yMax = 0;
  let yMin = 0;
  let xMin = 0;
  for (const d of datasets) {
    for (const p of d.data) {
      if (p.x > xMax) xMax = p.x;
      if (p.x < xMin) xMin = p.x;
      if (p.y > yMax) yMax = p.y;
      if (p.y < yMin) yMin = p.y;
    }
  }
  const sx = chart.options.scales.x;
  const sy = chart.options.scales.y;
  if (kind === 'fv') {
    sx.min = Math.floor(Math.min(0, xMin) * 2) / 2;
    sx.max = fixed.xMax ?? Math.max(2, Math.ceil(xMax + 0.3));
    // Even flow limits keep the 2 L/s tick spacing aligned with zero.
    sy.max = fixed.yMax ?? Math.max(2, 2 * Math.ceil((yMax + 0.5) / 2));
    sy.min = fixed.yMin ?? Math.min(-2, -2 * Math.ceil((-yMin + 0.5) / 2));
  } else {
    sx.max = fixed.xMax ?? Math.max(10, Math.ceil(xMax + 0.5));
    sy.max = fixed.yMax ?? Math.max(2, Math.ceil(yMax + 0.4));
  }
  chart.options.plugins.annotation.annotations = {
    ...(kind === 'fv' ? { zero: { type: 'line', yMin: 0, yMax: 0, borderColor: COLORS.axis, borderWidth: 1 } } : {}),
    ...annotations,
  };
  chart.update('none');
}

/** FEV1 / FVC markers for the volume–time chart. */
export function vtAnnotations(m, color = COLORS.pre) {
  if (!m) return {};
  return {
    fev1Line: { type: 'line', xMin: 1, xMax: 1, borderColor: 'rgba(100,116,139,0.6)', borderWidth: 1, borderDash: [4, 4] },
    fev1Pt: { type: 'point', xValue: 1, yValue: m.FEV1, radius: 4, backgroundColor: color, borderColor: '#fff', borderWidth: 1.5 },
    fev1Lbl: { type: 'label', xValue: 1, yValue: m.FEV1, xAdjust: 34, yAdjust: 12, content: `FEV₁ ${m.FEV1.toFixed(2)} L`, font: { size: 11, weight: '600' }, color },
    fvcLine: { type: 'line', yMin: m.FVC, yMax: m.FVC, borderColor: 'rgba(100,116,139,0.45)', borderWidth: 1, borderDash: [2, 3] },
    fvcLbl: { type: 'label', xValue: Math.max(3, m.FET - 1.5), yValue: m.FVC, yAdjust: -10, content: `FVC ${m.FVC.toFixed(2)} L`, font: { size: 11, weight: '600' }, color },
  };
}
