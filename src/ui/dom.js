/** Small DOM and formatting helpers. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Format a number, or an em dash when missing. */
export function fmt(v, digits = 2) {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits);
}

/** Format a reference-table row value with its parameter definition. */
export function fmtParam(p, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (p.pct) return (v * 100).toFixed(p.digits);
  return (v * (p.scale ?? 1)).toFixed(p.digits);
}

export function zClass(z) {
  if (z == null || !Number.isFinite(z)) return '';
  if (z < -1.645) return 'text-rose-700 font-semibold';
  if (z > 1.645) return 'text-amber-700';
  return 'text-slate-800';
}

export const statusTag = (status) =>
  status === 'acceptable'
    ? '<span class="tag-ok">Acceptable</span>'
    : status === 'usable'
      ? '<span class="tag-warn">Usable</span>'
      : '<span class="tag-bad">Not usable</span>';

export function gradeTag(g) {
  const cls = g === 'A' || g === 'B' ? 'tag-ok' : g === 'C' || g === 'D' ? 'tag-info' : g === 'E' || g === 'U' ? 'tag-warn' : 'tag-bad';
  return `<span class="${cls} min-w-6 justify-center text-xs">${g}</span>`;
}

export const ARTEFACT_LABELS = {
  slowStart: 'Slow start / hesitation',
  cough: 'Cough in first second',
  earlyTermination: 'Early termination',
  submaxInspiration: 'Submaximal inspiration',
};
