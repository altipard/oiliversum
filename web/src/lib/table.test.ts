import { describe, expect, it } from 'vitest';
import type { BreakdownRow, CountryStatRow } from '../data/types';
import { buildCountryRows, nextSort, priceOf, sortCountryRows, taxShare, type CountryRow } from './table';

function row(code: string, week: string, withTax: number | null, withoutTax: number | null, fuel: 'euro95' | 'diesel' = 'euro95'): BreakdownRow {
  const tax = withTax != null && withoutTax != null ? withTax - withoutTax : null;
  return {
    week_date: week,
    country_code: code,
    fuel_type: fuel,
    eur_1000l_with_tax: withTax,
    eur_1000l_without_tax: withoutTax,
    tax_eur_1000l: tax,
    crude_eur_1000l: 600,
    margin_eur_1000l: withoutTax != null ? withoutTax - 600 : null,
    crude_share: withTax ? 600 / withTax : null,
  };
}

describe('priceOf / taxShare', () => {
  const r = row('DE', '2026-09-21', 2000, 1000);

  it('picks the price for the tax mode', () => {
    expect(priceOf(r, 'with')).toBe(2000);
    expect(priceOf(r, 'without')).toBe(1000);
  });

  it('computes the tax share of the price incl. tax', () => {
    expect(taxShare(r)).toBeCloseTo(0.5);
    expect(taxShare(row('DE', '2026-09-21', null, 1000))).toBeNull();
    expect(taxShare(row('DE', '2026-09-21', 0, 0))).toBeNull();
  });
});

describe('buildCountryRows', () => {
  const latest = [row('DE', '2026-09-21', 2000, 1000), row('PL', '2026-09-21', 1500, 900), row('DE', '2026-09-21', 1900, 1100, 'diesel')];
  const previous = [row('DE', '2026-09-14', 2100, 1050)];
  const stats: CountryStatRow[] = [
    { country_code: 'DE', fuel_type: 'euro95', lag_weeks: 2, asymmetry: 1.3, computed_at: '2026-09-29T00:00:00Z' },
    { country_code: 'DE', fuel_type: 'diesel', lag_weeks: 5, asymmetry: 1.1, computed_at: '2026-09-29T00:00:00Z' },
  ];

  it('builds one row per country for the fuel type with week change and lag', () => {
    const rows = buildCountryRows(latest, previous, stats, 'euro95', 'with');
    expect(rows.map((r) => r.code)).toEqual(['DE', 'PL']);
    const de = rows[0]!;
    expect(de.name).toBe('Deutschland');
    expect(de.price).toBe(2000);
    expect(de.change).toBeCloseTo(2000 / 2100 - 1);
    expect(de.taxShare).toBeCloseTo(0.5);
    expect(de.crudeShare).toBeCloseTo(0.3);
    expect(de.lagWeeks).toBe(2);
  });

  it('uses the price without tax for the change in that mode', () => {
    const de = buildCountryRows(latest, previous, stats, 'euro95', 'without')[0]!;
    expect(de.price).toBe(1000);
    expect(de.change).toBeCloseTo(1000 / 1050 - 1);
  });

  it('leaves change and lag empty when there is no data', () => {
    const pl = buildCountryRows(latest, previous, [], 'euro95', 'with')[1]!;
    expect(pl.change).toBeNull();
    expect(pl.lagWeeks).toBeNull();
  });
});

describe('sortCountryRows', () => {
  const base = { taxShare: null, crudeShare: null, lagWeeks: null, change: null };
  const rows: CountryRow[] = [
    { ...base, code: 'AT', name: 'Österreich', price: 1900 },
    { ...base, code: 'DE', name: 'Deutschland', price: null },
    { ...base, code: 'BE', name: 'Belgien', price: 2100 },
    { ...base, code: 'PL', name: 'Polen', price: 1500 },
  ];

  it('sorts numbers both ways with missing values last', () => {
    expect(sortCountryRows(rows, 'price', 'desc').map((r) => r.code)).toEqual(['BE', 'AT', 'PL', 'DE']);
    expect(sortCountryRows(rows, 'price', 'asc').map((r) => r.code)).toEqual(['PL', 'AT', 'BE', 'DE']);
  });

  it('sorts names with German collation', () => {
    expect(sortCountryRows(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Belgien', 'Deutschland', 'Österreich', 'Polen']);
  });

  it('does not mutate the input', () => {
    sortCountryRows(rows, 'price', 'asc');
    expect(rows[0]!.code).toBe('AT');
  });
});

describe('nextSort', () => {
  it('flips the active column and starts new columns in a sensible direction', () => {
    expect(nextSort({ key: 'price', dir: 'desc' }, 'price')).toEqual({ key: 'price', dir: 'asc' });
    expect(nextSort({ key: 'price', dir: 'asc' }, 'change')).toEqual({ key: 'change', dir: 'desc' });
    expect(nextSort({ key: 'price', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });
});
