import type { NewsItem } from '../data/types';
import { shiftDate } from './brent';

export type Period = '1M' | '6M' | '1J' | '5J';

export const PERIODS: readonly Period[] = ['1M', '6M', '1J', '5J'];

const PERIOD_MONTHS: Record<Period, number> = { '1M': 1, '6M': 6, '1J': 12, '5J': 60 };

/** First date (inclusive) of a period ending at `end`, by calendar months. */
export function periodStart(end: string, period: Period): string {
  const d = new Date(`${end}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - PERIOD_MONTHS[period]);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

export const MAX_SELECTED = 4;

/** Adds a country to the selection (max. 4, no duplicates); returns the same list if nothing changes. */
export function addCountry(selected: readonly string[], code: string): readonly string[] {
  if (selected.includes(code) || selected.length >= MAX_SELECTED) return selected;
  return [...selected, code];
}

export function removeCountry(selected: readonly string[], code: string): readonly string[] {
  return selected.includes(code) ? selected.filter((c) => c !== code) : selected;
}

export const NEWS_MIN_RELEVANCE = 0.6;
export const NEWS_LIMIT = 15;

/** Most relevant news above the threshold, newest first on ties. */
export function topNews(items: readonly NewsItem[], limit = NEWS_LIMIT): NewsItem[] {
  return items
    .filter((n) => n.relevance != null && n.relevance > NEWS_MIN_RELEVANCE)
    .sort((a, b) => b.relevance! - a.relevance! || (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, limit);
}

/** News published within ±`days` of a date, e.g. for the tooltip of a weekly point. */
export function newsNear(items: readonly NewsItem[], date: string, days: number): NewsItem[] {
  const from = shiftDate(date, -days);
  const to = shiftDate(date, days);
  return items.filter((n) => {
    const d = n.published_at?.slice(0, 10);
    return d != null && d >= from && d <= to;
  });
}
