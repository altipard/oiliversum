import { describe, expect, it } from 'vitest';
import { BARREL_LITERS, brentHeadline, latestOnOrBefore, pctChange, shiftDate, usdBblToEurLiter } from './brent';

describe('pctChange', () => {
  it('returns the relative change', () => {
    expect(pctChange(94, 100)).toBeCloseTo(-0.06);
    expect(pctChange(110, 100)).toBeCloseTo(0.1);
  });

  it('is null for missing or zero base values', () => {
    expect(pctChange(1, 0)).toBeNull();
    expect(pctChange(null, 1)).toBeNull();
    expect(pctChange(1, undefined)).toBeNull();
  });
});

describe('usdBblToEurLiter', () => {
  it('divides by the EURUSD rate and the barrel volume', () => {
    expect(usdBblToEurLiter(100, 1.25)).toBeCloseTo(80 / BARREL_LITERS, 10);
  });
});

describe('shiftDate', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2025-12-29', 7)).toBe('2026-01-05');
  });
});

describe('latestOnOrBefore', () => {
  const rows = [{ date: '2026-09-18' }, { date: '2026-09-22' }, { date: '2026-09-21' }];

  it('picks the newest row not after the date', () => {
    expect(latestOnOrBefore(rows, '2026-09-21')?.date).toBe('2026-09-21');
    expect(latestOnOrBefore(rows, '2026-09-20')?.date).toBe('2026-09-18');
  });

  it('returns undefined if all rows are later', () => {
    expect(latestOnOrBefore(rows, '2026-01-01')).toBeUndefined();
  });
});

describe('brentHeadline', () => {
  const crude = [
    { date: '2026-09-22', price_usd_bbl: 94 },
    { date: '2026-09-21', price_usd_bbl: 95 },
    { date: '2026-09-15', price_usd_bbl: 100 },
    { date: '2026-09-14', price_usd_bbl: 99 },
  ];

  it('uses the FX rate of the same or last earlier day', () => {
    const fx = [
      { date: '2026-09-23', rate: 2 },
      { date: '2026-09-19', rate: 1.25 },
    ];
    const h = brentHeadline(crude, fx)!;
    expect(h.date).toBe('2026-09-22');
    expect(h.usdBbl).toBe(94);
    expect(h.fxDate).toBe('2026-09-19');
    expect(h.eurLiter).toBeCloseTo(94 / 1.25 / BARREL_LITERS, 10);
  });

  it('compares with the previous trading day and the day a week earlier', () => {
    const h = brentHeadline(crude, [])!;
    expect(h.changeDay).toBeCloseTo(94 / 95 - 1);
    expect(h.changeWeek).toBeCloseTo(-0.06);
    expect(h.eurLiter).toBeNull();
  });

  it('is null without quotes and tolerates a single quote', () => {
    expect(brentHeadline([], [])).toBeNull();
    const h = brentHeadline([{ date: '2026-09-22', price_usd_bbl: 90 }], [])!;
    expect(h.changeDay).toBeNull();
    expect(h.changeWeek).toBeNull();
  });
});
