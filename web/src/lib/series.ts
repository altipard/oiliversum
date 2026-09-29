import type { BreakdownRow, CrudeWeeklyRow, FuelType, NewsItem } from '../data/types';
import { perLiter } from './format';
import { priceOf, type TaxMode } from './table';

export type Point = [date: string, value: number];

/** Weekly Brent in EUR per litre from `from` on, ascending. */
export function brentLine(rows: readonly CrudeWeeklyRow[], from: string): Point[] {
  return rows
    .filter((r) => r.week_date >= from)
    .map((r): Point => [r.week_date, r.brent_eur_1000l / 1000])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** Pump price in EUR per litre of one country from `from` on, ascending; weeks without a price are skipped. */
export function priceLine(rows: readonly BreakdownRow[], fuel: FuelType, tax: TaxMode, from: string): Point[] {
  const out: Point[] = [];
  for (const r of rows) {
    if (r.fuel_type !== fuel || r.week_date < from) continue;
    const v = perLiter(priceOf(r, tax));
    if (v != null) out.push([r.week_date, v]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

export interface NewsMarker {
  date: string;
  value: number;
  item: NewsItem;
}

/**
 * Places each news item on the Brent line: at the value of the last week on or
 * before its publication date (news after the last week sit on its value).
 * Items older than the line or without a date are dropped.
 */
export function newsMarkers(items: readonly NewsItem[], line: readonly Point[]): NewsMarker[] {
  if (line.length === 0) return [];
  const first = line[0]![0];
  const markers: NewsMarker[] = [];
  for (const item of items) {
    const date = item.published_at?.slice(0, 10);
    if (!date || date < first) continue;
    let value = line[0]![1];
    for (const [d, v] of line) {
      if (d > date) break;
      value = v;
    }
    markers.push({ date, value, item });
  }
  return markers;
}
