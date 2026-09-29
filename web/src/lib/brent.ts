import type { CrudePriceRow, FxRateRow } from '../data/types';

/** Litres per US oil barrel (same constant as the crude_weekly view). */
export const BARREL_LITERS = 158.987294928;

export interface BrentHeadline {
  date: string;
  usdBbl: number;
  fxDate: string | null;
  eurLiter: number | null;
  changeDay: number | null;
  changeWeek: number | null;
}

/** Relative change from `before` to `after`; null if not computable. */
export function pctChange(after: number | null | undefined, before: number | null | undefined): number | null {
  if (after == null || before == null || !Number.isFinite(after) || !Number.isFinite(before) || before === 0) {
    return null;
  }
  return after / before - 1;
}

/** USD per barrel -> EUR per litre, `eurusd` = USD per 1 EUR. */
export function usdBblToEurLiter(usdBbl: number, eurusd: number): number {
  return usdBbl / eurusd / BARREL_LITERS;
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Latest row with date <= `date` (rows in any order). */
export function latestOnOrBefore<T extends { date: string }>(rows: readonly T[], date: string): T | undefined {
  let best: T | undefined;
  for (const r of rows) {
    if (r.date <= date && (!best || r.date > best.date)) best = r;
  }
  return best;
}

/**
 * Headline figures for the last Brent trading day: price, EUR/l converted with the
 * EURUSD rate of the same or the last earlier day, change to the previous trading
 * day and to the last trading day at least 7 days earlier.
 */
export function brentHeadline(crude: readonly CrudePriceRow[], fx: readonly FxRateRow[]): BrentHeadline | null {
  if (crude.length === 0) return null;
  const sorted = [...crude].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = sorted[0]!;
  const prev = sorted[1];
  const weekAgo = latestOnOrBefore(sorted, shiftDate(last.date, -7));
  const rate = latestOnOrBefore(fx, last.date);
  return {
    date: last.date,
    usdBbl: last.price_usd_bbl,
    fxDate: rate?.date ?? null,
    eurLiter: rate ? usdBblToEurLiter(last.price_usd_bbl, rate.rate) : null,
    changeDay: pctChange(last.price_usd_bbl, prev?.price_usd_bbl),
    changeWeek: pctChange(last.price_usd_bbl, weekAgo?.price_usd_bbl),
  };
}
