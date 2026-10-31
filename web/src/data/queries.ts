// Static JSON files written by `ingest export` into public/data.
import type { BreakdownRow, CountryStatRow, CrudePriceRow, CrudeWeeklyRow, FxRateRow, MarketEvent, NewsItem } from './types';

const DATA_URL = `${import.meta.env.BASE_URL}data/`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(DATA_URL + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface LatestWeeks {
  latestWeek: string | null;
  previousWeek: string | null;
  latest: BreakdownRow[];
  previous: BreakdownRow[];
}

export interface Summary {
  generatedAt: string;
  /** Last Brent quotes (enough for day and week change), newest first. */
  brent: CrudePriceRow[];
  /** Matching EURUSD rates, newest first. */
  fx: FxRateRow[];
  /** Reference date of the newest bulletin week, or null if empty. */
  latestBulletin: string | null;
  /** Breakdown rows of the two newest weeks that have a crude_weekly row. */
  weeks: LatestWeeks;
  countryStats: CountryStatRow[];
}

let summary: Promise<Summary> | null = null;
let crudeWeekly: Promise<CrudeWeeklyRow[]> | null = null;
let news: Promise<NewsItem[]> | null = null;

export function fetchSummary(): Promise<Summary> {
  summary ??= getJson<Summary>('summary.json');
  return summary;
}

/** Weekly Brent in EUR per 1000 l from `from` on, ascending. */
export async function fetchCrudeWeekly(from: string): Promise<CrudeWeeklyRow[]> {
  crudeWeekly ??= getJson<CrudeWeeklyRow[]>('crude-weekly.json');
  return (await crudeWeekly).filter((r) => r.week_date >= from);
}

/** Both fuel types of one country from `from` on, ascending; empty for countries without data. */
export async function fetchCountrySeries(code: string, from: string): Promise<BreakdownRow[]> {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`Ungültiger Ländercode: ${code}`);
  const res = await fetch(`${DATA_URL}series/${code}.json`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`series/${code}.json: HTTP ${res.status}`);
  return ((await res.json()) as BreakdownRow[]).filter((r) => r.week_date >= from);
}

function allNews(): Promise<NewsItem[]> {
  news ??= getJson<NewsItem[]>('news.json');
  return news;
}

/** The most relevant news items above `minRelevance`. */
export async function fetchTopNews(minRelevance: number, limit: number): Promise<NewsItem[]> {
  return (await allNews())
    .filter((n) => (n.relevance ?? 0) > minRelevance)
    .sort(
      (a, b) =>
        (b.relevance ?? 0) - (a.relevance ?? 0) || (b.published_at ?? '').localeCompare(a.published_at ?? ''),
    )
    .slice(0, limit);
}

/** Relevant news published since `from`, ascending, for markers on the time axis. */
export async function fetchNewsSince(from: string, minRelevance: number): Promise<NewsItem[]> {
  return (await allNews())
    .filter((n) => (n.relevance ?? 0) > minRelevance && n.published_at !== null && n.published_at >= from)
    .sort((a, b) => a.published_at!.localeCompare(b.published_at!));
}

let marketEvents: Promise<MarketEvent[]> | null = null;

function allEvents(): Promise<MarketEvent[]> {
  marketEvents ??= getJson<MarketEvent[]>('events.json');
  return marketEvents;
}

/** Curated events from `from` on, ascending, for markers on the time axis. */
export async function fetchEventsSince(from: string): Promise<MarketEvent[]> {
  return (await allEvents())
    .filter((e) => e.event_date >= from)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
}
