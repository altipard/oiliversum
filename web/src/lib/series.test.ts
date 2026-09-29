import { describe, expect, it } from 'vitest';
import type { BreakdownRow, CrudeWeeklyRow, NewsItem } from '../data/types';
import { brentLine, newsMarkers, priceLine } from './series';

function crude(week: string, eur1000l: number): CrudeWeeklyRow {
  return { week_date: week, brent_usd_bbl: 0, eurusd: 1, brent_eur_1000l: eur1000l, trading_days: 5 };
}

function price(week: string, fuel: 'euro95' | 'diesel', withTax: number | null, withoutTax: number | null): BreakdownRow {
  return {
    week_date: week,
    country_code: 'DE',
    fuel_type: fuel,
    eur_1000l_with_tax: withTax,
    eur_1000l_without_tax: withoutTax,
    tax_eur_1000l: null,
    crude_eur_1000l: null,
    margin_eur_1000l: null,
    crude_share: null,
  };
}

describe('brentLine', () => {
  it('filters by start date, converts to EUR per litre and sorts', () => {
    const line = brentLine([crude('2026-09-21', 678), crude('2026-09-07', 537), crude('2026-09-14', 605)], '2026-09-10');
    expect(line.map((p) => p[0])).toEqual(['2026-09-14', '2026-09-21']);
    expect(line[1]![1]).toBeCloseTo(0.678);
  });
});

describe('priceLine', () => {
  const rows = [
    price('2026-09-21', 'euro95', 1925, 1009),
    price('2026-09-14', 'euro95', null, 1000),
    price('2026-09-07', 'euro95', 1900, 990),
    price('2026-09-21', 'diesel', 2238, 1341),
  ];

  it('selects fuel and tax mode and skips weeks without a price', () => {
    expect(priceLine(rows, 'euro95', 'with', '2026-01-01')).toEqual([
      ['2026-09-07', 1.9],
      ['2026-09-21', 1.925],
    ]);
    expect(priceLine(rows, 'euro95', 'without', '2026-09-10').map((p) => p[0])).toEqual(['2026-09-14', '2026-09-21']);
    expect(priceLine(rows, 'diesel', 'with', '2026-01-01')).toEqual([['2026-09-21', 2.238]]);
  });
});

describe('newsMarkers', () => {
  const line: [string, number][] = [
    ['2026-09-07', 0.5],
    ['2026-09-14', 0.6],
    ['2026-09-21', 0.7],
  ];
  const item = (published_at: string | null): NewsItem => ({
    title: 't',
    url: 'https://example.org',
    published_at,
    relevance: 0.9,
    direction: 'bearish',
    source: 's',
  });

  it('puts each item on the Brent value of the last week on or before it', () => {
    const m = newsMarkers([item('2026-09-16T10:00:00Z'), item('2026-09-14'), item('2026-09-25')], line);
    expect(m.map((x) => [x.date, x.value])).toEqual([
      ['2026-09-16', 0.6],
      ['2026-09-14', 0.6],
      ['2026-09-25', 0.7],
    ]);
  });

  it('drops items before the line or without date', () => {
    expect(newsMarkers([item('2026-09-01'), item(null)], line)).toEqual([]);
    expect(newsMarkers([item('2026-09-16')], [])).toEqual([]);
  });
});
