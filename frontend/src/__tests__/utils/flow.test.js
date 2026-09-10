import { describe, it, expect } from 'vitest';
import { currentMonthRows, formatLitres, formatRate, lastDays, totalLitres } from '../../utils/flow';

describe('formatRate', () => {
  it('formats a rate with one decimal', () => {
    expect(formatRate(12.53)).toBe('12.5 L/min');
    expect(formatRate(0)).toBe('0.0 L/min');
  });

  it('renders a dash when there is no reading', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
    expect(formatRate(NaN)).toBe('—');
  });
});

describe('formatLitres', () => {
  it('rounds litres below 1000', () => {
    expect(formatLitres(340.4)).toBe('340 L');
    expect(formatLitres(0)).toBe('0 L');
  });

  it('switches to cubic metres from 1000 L', () => {
    expect(formatLitres(1000)).toBe('1.00 m³');
    expect(formatLitres(12345)).toBe('12.35 m³');
  });

  it('renders a dash when there is no reading', () => {
    expect(formatLitres(null)).toBe('—');
    expect(formatLitres(undefined)).toBe('—');
  });
});

describe('totalLitres', () => {
  it('sums the intervals that have a reading', () => {
    expect(totalLitres([{ litres: 10 }, { litres: null }, { litres: 5 }])).toBe(15);
  });

  it('returns null when every interval is empty', () => {
    expect(totalLitres([{ litres: null }, { litres: null }])).toBeNull();
    expect(totalLitres([])).toBeNull();
    expect(totalLitres(null)).toBeNull();
  });

  it('keeps 0 distinct from no data', () => {
    expect(totalLitres([{ litres: 0 }])).toBe(0);
  });
});

describe('lastDays', () => {
  const rows = [1, 2, 3, 4, 5].map(n => ({ litres: n }));

  it('returns the trailing window', () => {
    expect(lastDays(rows, 2)).toEqual([{ litres: 4 }, { litres: 5 }]);
  });

  it('returns everything when the window is longer than the series', () => {
    expect(lastDays(rows, 50)).toHaveLength(5);
  });

  it('tolerates a missing series', () => {
    expect(lastDays(undefined, 7)).toEqual([]);
  });
});

describe('currentMonthRows', () => {
  const rows = [
    { date: '2026-08-30', litres: 1 },
    { date: '2026-08-31', litres: 2 },
    { date: '2026-09-01', litres: 3 },
    { date: '2026-09-10', litres: 4 },
  ];

  it('keeps only the rows of the reference month', () => {
    expect(currentMonthRows(rows, new Date(2026, 8, 10))).toEqual([
      { date: '2026-09-01', litres: 3 },
      { date: '2026-09-10', litres: 4 },
    ]);
  });

  it('pads single-digit months', () => {
    expect(currentMonthRows([{ date: '2026-01-05' }], new Date(2026, 0, 20))).toHaveLength(1);
  });

  it('ignores rows without a date', () => {
    expect(currentMonthRows([{ litres: 1 }], new Date(2026, 8, 10))).toEqual([]);
  });
});
