import { describe, expect, it } from 'vitest';
import type { NewsItem } from '../data/types';
import { addCountry, newsNear, periodStart, removeCountry, topNews } from './timeline';

function news(title: string, relevance: number | null, published_at: string | null): NewsItem {
  return { title, url: `https://example.org/${title}`, published_at, relevance, direction: 'neutral', source: 'test' };
}

describe('periodStart', () => {
  it('goes back whole calendar months', () => {
    expect(periodStart('2026-09-21', '1M')).toBe('2026-08-21');
    expect(periodStart('2026-09-21', '6M')).toBe('2026-03-21');
    expect(periodStart('2026-09-21', '1J')).toBe('2025-09-21');
    expect(periodStart('2026-09-21', '5J')).toBe('2021-09-21');
  });

  it('clamps to the last day of shorter months', () => {
    expect(periodStart('2026-03-31', '1M')).toBe('2026-02-28');
    expect(periodStart('2028-08-31', '6M')).toBe('2028-02-29');
  });
});

describe('country selection', () => {
  it('adds up to four distinct countries', () => {
    const four = ['DE', 'FR', 'IT', 'PL'];
    expect(addCountry(['DE'], 'PL')).toEqual(['DE', 'PL']);
    expect(addCountry(four, 'AT')).toBe(four);
    const two = ['DE', 'FR'];
    expect(addCountry(two, 'DE')).toBe(two);
  });

  it('removes a country', () => {
    expect(removeCountry(['DE', 'FR'], 'DE')).toEqual(['FR']);
    const list = ['DE'];
    expect(removeCountry(list, 'AT')).toBe(list);
  });
});

describe('topNews', () => {
  it('keeps items above 0.6, most relevant first, at most the limit', () => {
    const items = [
      news('a', 0.6, '2026-09-20'),
      news('b', 0.9, '2026-09-10'),
      news('c', 0.7, '2026-09-21'),
      news('d', null, '2026-09-21'),
      news('e', 0.9, '2026-09-22'),
    ];
    expect(topNews(items).map((n) => n.title)).toEqual(['e', 'b', 'c']);
    expect(topNews(items, 2).map((n) => n.title)).toEqual(['e', 'b']);
  });
});

describe('newsNear', () => {
  it('finds items within the window around a date', () => {
    const items = [
      news('before', 0.8, '2026-09-17T08:00:00Z'),
      news('in', 0.8, '2026-09-19T08:00:00Z'),
      news('edge', 0.8, '2026-09-24T23:00:00Z'),
      news('undated', 0.8, null),
    ];
    expect(newsNear(items, '2026-09-21', 3).map((n) => n.title)).toEqual(['in', 'edge']);
  });
});
