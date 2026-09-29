// Row shapes as returned by PostgREST (numeric columns arrive as JSON numbers).

export type FuelType = 'euro95' | 'diesel';

export interface CrudePriceRow {
  date: string;
  price_usd_bbl: number;
}

export interface FxRateRow {
  date: string;
  rate: number;
}

export interface CrudeWeeklyRow {
  week_date: string;
  brent_usd_bbl: number;
  eurusd: number;
  brent_eur_1000l: number;
  trading_days: number;
}

export interface BreakdownRow {
  week_date: string;
  country_code: string;
  fuel_type: FuelType;
  eur_1000l_with_tax: number | null;
  eur_1000l_without_tax: number | null;
  tax_eur_1000l: number | null;
  crude_eur_1000l: number | null;
  margin_eur_1000l: number | null;
  crude_share: number | null;
}

export interface CountryStatRow {
  country_code: string;
  fuel_type: FuelType;
  lag_weeks: number | null;
  asymmetry: number | null;
  computed_at: string;
}

export type NewsDirection = 'bullish' | 'bearish' | 'neutral';

export interface NewsItem {
  title: string;
  url: string;
  published_at: string | null;
  relevance: number | null;
  direction: NewsDirection | null;
  source: string;
}

export interface IngestRun {
  job: string;
  finished_at: string | null;
  status: string;
}
