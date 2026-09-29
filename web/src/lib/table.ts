import type { BreakdownRow, CountryStatRow, FuelType } from '../data/types';
import { pctChange } from './brent';
import { countryNameDe } from './countries';

export type TaxMode = 'with' | 'without';

/** Pump price in EUR per 1000 l for the chosen tax mode. */
export function priceOf(row: BreakdownRow, tax: TaxMode): number | null {
  return tax === 'with' ? row.eur_1000l_with_tax : row.eur_1000l_without_tax;
}

/** Share of taxes in the price incl. tax (0..1). */
export function taxShare(row: BreakdownRow): number | null {
  const total = row.eur_1000l_with_tax;
  if (row.tax_eur_1000l == null || total == null || total === 0) return null;
  return row.tax_eur_1000l / total;
}

export interface CountryRow {
  code: string;
  name: string;
  price: number | null;
  change: number | null;
  taxShare: number | null;
  crudeShare: number | null;
  lagWeeks: number | null;
}

/** One row per country of the latest week for a fuel type; change against the previous week. */
export function buildCountryRows(
  latest: readonly BreakdownRow[],
  previous: readonly BreakdownRow[],
  stats: readonly CountryStatRow[],
  fuel: FuelType,
  tax: TaxMode,
): CountryRow[] {
  const prevByCode = new Map(previous.filter((r) => r.fuel_type === fuel).map((r) => [r.country_code, r]));
  const lagByCode = new Map(stats.filter((s) => s.fuel_type === fuel).map((s) => [s.country_code, s.lag_weeks]));
  return latest
    .filter((r) => r.fuel_type === fuel)
    .map((r) => {
      const prev = prevByCode.get(r.country_code);
      const price = priceOf(r, tax);
      return {
        code: r.country_code,
        name: countryNameDe(r.country_code),
        price,
        change: prev ? pctChange(price, priceOf(prev, tax)) : null,
        taxShare: taxShare(r),
        crudeShare: r.crude_share,
        lagWeeks: lagByCode.get(r.country_code) ?? null,
      };
    });
}

export type SortKey = 'name' | 'price' | 'change' | 'taxShare' | 'crudeShare' | 'lagWeeks';
export type SortDir = 'asc' | 'desc';

/** Sorts a copy; missing values always go last, names use German collation. */
export function sortCountryRows(rows: readonly CountryRow[], key: SortKey, dir: SortDir): CountryRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * a.name.localeCompare(b.name, 'de');
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return a.name.localeCompare(b.name, 'de');
    if (va == null) return 1;
    if (vb == null) return -1;
    return sign * (va - vb) || a.name.localeCompare(b.name, 'de');
  });
}

/** Clicking the active column flips the direction; a new column starts descending (names ascending). */
export function nextSort(current: { key: SortKey; dir: SortDir }, clicked: SortKey): { key: SortKey; dir: SortDir } {
  if (current.key === clicked) return { key: clicked, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key: clicked, dir: clicked === 'name' ? 'asc' : 'desc' };
}
