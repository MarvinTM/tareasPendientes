// Formatting and aggregation helpers for the flow sensor (Agua module).
//
// Litres always arrive already derived from the backend (pulses / pulsesPerLitre),
// and an interval with no readings arrives as null — never 0 — so a gap in the
// data is never rendered as "no water used".

export function formatRate(rateLpm) {
  if (rateLpm == null || Number.isNaN(rateLpm)) return '—';
  return `${rateLpm.toFixed(1)} L/min`;
}

export function formatLitres(litres) {
  if (litres == null || Number.isNaN(litres)) return '—';
  if (Math.abs(litres) >= 1000) return `${(litres / 1000).toFixed(2)} m³`;
  return `${Math.round(litres).toLocaleString()} L`;
}

// Sum of the litres in a daily/history series. Returns null when every interval
// is null, so "no data yet" stays distinguishable from "0 litres".
export function totalLitres(rows) {
  if (!Array.isArray(rows)) return null;
  let sum = 0;
  let any = false;
  for (const row of rows) {
    if (row?.litres != null) {
      sum += row.litres;
      any = true;
    }
  }
  return any ? sum : null;
}

export function lastDays(rows, days) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(Math.max(0, rows.length - days));
}

// Rows of the current natural month, matched on the YYYY-MM-DD date string the
// daily endpoint returns (already in Europe/Madrid).
export function currentMonthRows(rows, reference = new Date()) {
  if (!Array.isArray(rows)) return [];
  const prefix = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}`;
  return rows.filter(row => typeof row?.date === 'string' && row.date.startsWith(prefix));
}
