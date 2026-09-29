import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages, type PageResult } from '../lib/paging';
import type {
  BreakdownRow,
  CountryStatRow,
  CrudePriceRow,
  CrudeWeeklyRow,
  FxRateRow,
  NewsItem,
} from './types';

const BREAKDOWN_COLUMNS =
  'week_date,country_code,fuel_type,eur_1000l_with_tax,eur_1000l_without_tax,tax_eur_1000l,crude_eur_1000l,margin_eur_1000l,crude_share';
const NEWS_COLUMNS = 'title,url,published_at,relevance,direction,source';

function unwrap<T>({ data, error }: PageResult<T>): T[] {
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface BrentRecent {
  crude: CrudePriceRow[];
  fx: FxRateRow[];
}

/** Last Brent quotes (enough for day and week change) and matching EURUSD rates. */
export async function fetchBrentRecent(db: SupabaseClient): Promise<BrentRecent> {
  const [crude, fx] = await Promise.all([
    db
      .from('crude_prices')
      .select('date,price_usd_bbl')
      .eq('benchmark', 'brent')
      .order('date', { ascending: false })
      .limit(15),
    db.from('fx_rates').select('date,rate').eq('pair', 'EURUSD').order('date', { ascending: false }).limit(30),
  ]);
  return { crude: unwrap<CrudePriceRow>(crude), fx: unwrap<FxRateRow>(fx) };
}

/** Reference date of the newest bulletin week in fuel_prices, or null if empty. */
export async function fetchLatestBulletinDate(db: SupabaseClient): Promise<string | null> {
  const res = await db.from('fuel_prices').select('week_date').order('week_date', { ascending: false }).limit(1);
  return unwrap<{ week_date: string }>(res)[0]?.week_date ?? null;
}

export interface LatestWeeks {
  latestWeek: string | null;
  previousWeek: string | null;
  latest: BreakdownRow[];
  previous: BreakdownRow[];
}

/** Breakdown rows of the two newest weeks that have a crude_weekly row. */
export async function fetchLatestWeeks(db: SupabaseClient): Promise<LatestWeeks> {
  const weeks = unwrap<{ week_date: string }>(
    await db.from('crude_weekly').select('week_date').order('week_date', { ascending: false }).limit(2),
  ).map((w) => w.week_date);
  const [latestWeek = null, previousWeek = null] = weeks;
  if (!latestWeek) return { latestWeek, previousWeek, latest: [], previous: [] };
  const rows = unwrap<BreakdownRow>(
    await db.from('fuel_price_breakdown').select(BREAKDOWN_COLUMNS).in('week_date', weeks),
  );
  return {
    latestWeek,
    previousWeek,
    latest: rows.filter((r) => r.week_date === latestWeek),
    previous: rows.filter((r) => r.week_date === previousWeek),
  };
}

export async function fetchCountryStats(db: SupabaseClient): Promise<CountryStatRow[]> {
  return unwrap<CountryStatRow>(
    await db.from('country_stats').select('country_code,fuel_type,lag_weeks,asymmetry,computed_at'),
  );
}

/** Weekly Brent in EUR per 1000 l from `from` on, ascending. */
export async function fetchCrudeWeekly(db: SupabaseClient, from: string): Promise<CrudeWeeklyRow[]> {
  return fetchAllPages<CrudeWeeklyRow>((a, b) =>
    db
      .from('crude_weekly')
      .select('week_date,brent_usd_bbl,eurusd,brent_eur_1000l,trading_days')
      .gte('week_date', from)
      .order('week_date', { ascending: true })
      .range(a, b),
  );
}

/** Both fuel types of one country from `from` on, ascending. */
export async function fetchCountrySeries(db: SupabaseClient, code: string, from: string): Promise<BreakdownRow[]> {
  return fetchAllPages<BreakdownRow>((a, b) =>
    db
      .from('fuel_price_breakdown')
      .select(BREAKDOWN_COLUMNS)
      .eq('country_code', code)
      .gte('week_date', from)
      .order('week_date', { ascending: true })
      .order('fuel_type', { ascending: true })
      .range(a, b),
  );
}

/** The most relevant news items above `minRelevance`. */
export async function fetchTopNews(db: SupabaseClient, minRelevance: number, limit: number): Promise<NewsItem[]> {
  return unwrap<NewsItem>(
    await db
      .from('news_items')
      .select(NEWS_COLUMNS)
      .gt('relevance', minRelevance)
      .order('relevance', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit),
  );
}

/** Relevant news published since `from`, for markers on the time axis. */
export async function fetchNewsSince(db: SupabaseClient, from: string, minRelevance: number): Promise<NewsItem[]> {
  return fetchAllPages<NewsItem>((a, b) =>
    db
      .from('news_items')
      .select(NEWS_COLUMNS)
      .gt('relevance', minRelevance)
      .gte('published_at', from)
      .order('published_at', { ascending: true })
      .range(a, b),
  );
}
