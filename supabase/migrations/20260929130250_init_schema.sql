-- Schema for oil price vs. European fuel prices.
-- Writes happen only via service_role (ingest jobs); anon/authenticated read only.

-- ---------------------------------------------------------------------------
-- crude_prices
-- ---------------------------------------------------------------------------
create table public.crude_prices (
    date date not null,
    benchmark text not null check (benchmark in ('brent', 'wti')),
    price_usd_bbl numeric(10, 4) not null,
    source text not null check (source in ('fred', 'eia')),
    primary key (benchmark, date)
);

comment on table public.crude_prices is 'Daily crude oil spot prices per benchmark.';
comment on column public.crude_prices.date is 'Trading day of the quote.';
comment on column public.crude_prices.benchmark is 'Crude benchmark: brent or wti.';
comment on column public.crude_prices.price_usd_bbl is 'Spot price in USD per barrel (159 l).';
comment on column public.crude_prices.source is 'Upstream data source: fred or eia.';

-- ---------------------------------------------------------------------------
-- fx_rates
-- ---------------------------------------------------------------------------
create table public.fx_rates (
    date date not null,
    pair text not null check (pair ~ '^[A-Z]{6}$'),
    rate numeric(12, 6) not null,
    primary key (pair, date)
);

comment on table public.fx_rates is 'Daily ECB reference exchange rates.';
comment on column public.fx_rates.date is 'Reference date of the rate.';
comment on column public.fx_rates.pair is 'Currency pair, base then quote currency (e.g. EURUSD).';
comment on column public.fx_rates.rate is 'Units of quote currency per 1 unit of base currency (EURUSD: USD per 1 EUR).';

-- ---------------------------------------------------------------------------
-- fuel_prices
-- ---------------------------------------------------------------------------
create table public.fuel_prices (
    week_date date not null,
    country_code char(2) not null,
    fuel_type text not null check (fuel_type in ('euro95', 'diesel')),
    eur_1000l_with_tax numeric(10, 2),
    eur_1000l_without_tax numeric(10, 2),
    primary key (country_code, fuel_type, week_date)
);

comment on table public.fuel_prices is 'Weekly consumer fuel prices from the EU Weekly Oil Bulletin.';
comment on column public.fuel_prices.week_date is 'Bulletin reference date (Monday).';
comment on column public.fuel_prices.country_code is 'ISO 3166-1 alpha-2 country code (Greece is GR, not EL).';
comment on column public.fuel_prices.fuel_type is 'Fuel type: euro95 (Euro-super 95) or diesel.';
comment on column public.fuel_prices.eur_1000l_with_tax is 'Consumer price in EUR per 1000 l incl. duties and taxes.';
comment on column public.fuel_prices.eur_1000l_without_tax is 'Price in EUR per 1000 l excl. duties and taxes.';

-- ---------------------------------------------------------------------------
-- news_items
-- ---------------------------------------------------------------------------
create table public.news_items (
    id bigint generated always as identity primary key,
    source text not null,
    title text not null,
    url text not null unique,
    published_at timestamptz,
    summary text,
    relevance numeric(3, 2) check (relevance between 0 and 1),
    direction text check (direction in ('bullish', 'bearish', 'neutral')),
    tags text[] not null default '{}',
    created_at timestamptz not null default now()
);

create index news_items_published_at_idx on public.news_items (published_at desc);

comment on table public.news_items is 'Oil market news items from RSS feeds.';
comment on column public.news_items.source is 'Feed or publisher the item came from.';
comment on column public.news_items.url is 'Normalized article URL; upsert key.';
comment on column public.news_items.published_at is 'Publication timestamp as reported by the feed.';
comment on column public.news_items.relevance is 'Relevance score for oil prices, 0 (none) to 1 (high).';
comment on column public.news_items.direction is 'Expected price impact: bullish, bearish or neutral.';
comment on column public.news_items.tags is 'Free-form topic tags.';
comment on column public.news_items.created_at is 'Time the row was first stored.';

-- ---------------------------------------------------------------------------
-- country_stats
-- ---------------------------------------------------------------------------
create table public.country_stats (
    country_code char(2) not null,
    fuel_type text not null check (fuel_type in ('euro95', 'diesel')),
    lag_weeks int,
    asymmetry numeric,
    computed_at timestamptz not null default now(),
    primary key (country_code, fuel_type)
);

comment on table public.country_stats is 'Derived pass-through statistics per country and fuel type.';
comment on column public.country_stats.country_code is 'ISO 3166-1 alpha-2 country code (Greece is GR, not EL).';
comment on column public.country_stats.fuel_type is 'Fuel type: euro95 (Euro-super 95) or diesel.';
comment on column public.country_stats.lag_weeks is 'Lag in weeks between crude price change and pump price reaction.';
comment on column public.country_stats.asymmetry is 'Pass-through asymmetry, dimensionless (rises vs. falls).';
comment on column public.country_stats.computed_at is 'Time the statistics were computed.';

-- ---------------------------------------------------------------------------
-- ingest_runs
-- ---------------------------------------------------------------------------
create table public.ingest_runs (
    id bigint generated always as identity primary key,
    job text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null check (status in ('running', 'success', 'failed')),
    rows_written int not null default 0,
    error text
);

create index ingest_runs_job_started_at_idx on public.ingest_runs (job, started_at desc);

comment on table public.ingest_runs is 'Audit log of ingest job executions.';
comment on column public.ingest_runs.job is 'Ingest job name.';
comment on column public.ingest_runs.status is 'Run state: running, success or failed.';
comment on column public.ingest_runs.rows_written is 'Number of rows upserted by the run (count).';
comment on column public.ingest_runs.error is 'Error message of a failed run.';

-- ---------------------------------------------------------------------------
-- Access control: public read, writes only via service_role
-- ---------------------------------------------------------------------------
alter table public.crude_prices enable row level security;
alter table public.fx_rates enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.news_items enable row level security;
alter table public.country_stats enable row level security;
alter table public.ingest_runs enable row level security;

create policy "public read" on public.crude_prices for select to anon, authenticated using (true);
create policy "public read" on public.fx_rates for select to anon, authenticated using (true);
create policy "public read" on public.fuel_prices for select to anon, authenticated using (true);
create policy "public read" on public.news_items for select to anon, authenticated using (true);
create policy "public read" on public.country_stats for select to anon, authenticated using (true);
create policy "public read" on public.ingest_runs for select to anon, authenticated using (true);

-- Supabase grants all privileges to anon/authenticated by default; reduce them
-- to SELECT so a misconfigured policy cannot open writes.
revoke all
    on public.crude_prices,
       public.fx_rates,
       public.fuel_prices,
       public.news_items,
       public.country_stats,
       public.ingest_runs
    from anon, authenticated;

grant select
    on public.crude_prices,
       public.fx_rates,
       public.fuel_prices,
       public.news_items,
       public.country_stats,
       public.ingest_runs
    to anon, authenticated;

revoke usage, update
    on sequence public.news_items_id_seq,
                public.ingest_runs_id_seq
    from anon, authenticated;
