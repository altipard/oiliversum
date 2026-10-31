begin;
select plan(70);

-- tables
select has_table('public', 'crude_prices', 'crude_prices exists');
select has_table('public', 'fx_rates', 'fx_rates exists');
select has_table('public', 'fuel_prices', 'fuel_prices exists');
select has_table('public', 'news_items', 'news_items exists');
select has_table('public', 'market_events', 'market_events exists');
select has_table('public', 'country_stats', 'country_stats exists');
select has_table('public', 'ingest_runs', 'ingest_runs exists');

-- exact column sets
select columns_are('public', 'crude_prices',
    array['date', 'benchmark', 'price_usd_bbl', 'source']);
select columns_are('public', 'fx_rates',
    array['date', 'pair', 'rate']);
select columns_are('public', 'fuel_prices',
    array['week_date', 'country_code', 'fuel_type', 'eur_1000l_with_tax', 'eur_1000l_without_tax']);
select columns_are('public', 'news_items',
    array['id', 'source', 'title', 'url', 'published_at', 'summary', 'relevance', 'direction', 'tags', 'created_at']);
select columns_are('public', 'market_events',
    array['id', 'event_date', 'title', 'category', 'direction', 'severity', 'description', 'source_url', 'tags', 'created_at']);
select columns_are('public', 'country_stats',
    array['country_code', 'fuel_type', 'lag_weeks', 'asymmetry', 'computed_at']);
select columns_are('public', 'ingest_runs',
    array['id', 'job', 'started_at', 'finished_at', 'status', 'rows_written', 'error']);

-- primary keys
select col_is_pk('public', 'crude_prices', array['benchmark', 'date'], 'crude_prices pk (benchmark, date)');
select col_is_pk('public', 'fx_rates', array['pair', 'date'], 'fx_rates pk (pair, date)');
select col_is_pk('public', 'fuel_prices', array['country_code', 'fuel_type', 'week_date'], 'fuel_prices pk (country_code, fuel_type, week_date)');
select col_is_pk('public', 'news_items', array['id'], 'news_items pk (id)');
select col_is_pk('public', 'market_events', array['id'], 'market_events pk (id)');
select col_is_pk('public', 'country_stats', array['country_code', 'fuel_type'], 'country_stats pk (country_code, fuel_type)');
select col_is_pk('public', 'ingest_runs', array['id'], 'ingest_runs pk (id)');

-- column types
select col_type_is('public', 'crude_prices', 'date', 'date', 'crude_prices.date is date');
select col_type_is('public', 'crude_prices', 'benchmark', 'text', 'crude_prices.benchmark is text');
select col_type_is('public', 'crude_prices', 'price_usd_bbl', 'numeric(10,4)', 'crude_prices.price_usd_bbl is numeric(10,4)');
select col_type_is('public', 'crude_prices', 'source', 'text', 'crude_prices.source is text');

select col_type_is('public', 'fx_rates', 'date', 'date', 'fx_rates.date is date');
select col_type_is('public', 'fx_rates', 'pair', 'text', 'fx_rates.pair is text');
select col_type_is('public', 'fx_rates', 'rate', 'numeric(12,6)', 'fx_rates.rate is numeric(12,6)');

select col_type_is('public', 'fuel_prices', 'week_date', 'date', 'fuel_prices.week_date is date');
select col_type_is('public', 'fuel_prices', 'country_code', 'character(2)', 'fuel_prices.country_code is character(2)');
select col_type_is('public', 'fuel_prices', 'fuel_type', 'text', 'fuel_prices.fuel_type is text');
select col_type_is('public', 'fuel_prices', 'eur_1000l_with_tax', 'numeric(10,2)', 'fuel_prices.eur_1000l_with_tax is numeric(10,2)');
select col_type_is('public', 'fuel_prices', 'eur_1000l_without_tax', 'numeric(10,2)', 'fuel_prices.eur_1000l_without_tax is numeric(10,2)');

select col_type_is('public', 'news_items', 'id', 'bigint', 'news_items.id is bigint');
select col_type_is('public', 'news_items', 'source', 'text', 'news_items.source is text');
select col_type_is('public', 'news_items', 'title', 'text', 'news_items.title is text');
select col_type_is('public', 'news_items', 'url', 'text', 'news_items.url is text');
select col_type_is('public', 'news_items', 'published_at', 'timestamp with time zone', 'news_items.published_at is timestamp with time zone');
select col_type_is('public', 'news_items', 'summary', 'text', 'news_items.summary is text');
select col_type_is('public', 'news_items', 'relevance', 'numeric(3,2)', 'news_items.relevance is numeric(3,2)');
select col_type_is('public', 'news_items', 'direction', 'text', 'news_items.direction is text');
select col_type_is('public', 'news_items', 'tags', 'text[]', 'news_items.tags is text[]');
select col_type_is('public', 'news_items', 'created_at', 'timestamp with time zone', 'news_items.created_at is timestamp with time zone');

select col_type_is('public', 'market_events', 'id', 'bigint', 'market_events.id is bigint');
select col_type_is('public', 'market_events', 'event_date', 'date', 'market_events.event_date is date');
select col_type_is('public', 'market_events', 'title', 'text', 'market_events.title is text');
select col_type_is('public', 'market_events', 'category', 'text', 'market_events.category is text');
select col_type_is('public', 'market_events', 'direction', 'text', 'market_events.direction is text');
select col_type_is('public', 'market_events', 'severity', 'smallint', 'market_events.severity is smallint');
select col_type_is('public', 'market_events', 'description', 'text', 'market_events.description is text');
select col_type_is('public', 'market_events', 'source_url', 'text', 'market_events.source_url is text');
select col_type_is('public', 'market_events', 'tags', 'text[]', 'market_events.tags is text[]');
select col_type_is('public', 'market_events', 'created_at', 'timestamp with time zone', 'market_events.created_at is timestamp with time zone');

select col_type_is('public', 'country_stats', 'country_code', 'character(2)', 'country_stats.country_code is character(2)');
select col_type_is('public', 'country_stats', 'fuel_type', 'text', 'country_stats.fuel_type is text');
select col_type_is('public', 'country_stats', 'lag_weeks', 'integer', 'country_stats.lag_weeks is integer');
select col_type_is('public', 'country_stats', 'asymmetry', 'numeric', 'country_stats.asymmetry is numeric');
select col_type_is('public', 'country_stats', 'computed_at', 'timestamp with time zone', 'country_stats.computed_at is timestamp with time zone');

select col_type_is('public', 'ingest_runs', 'id', 'bigint', 'ingest_runs.id is bigint');
select col_type_is('public', 'ingest_runs', 'job', 'text', 'ingest_runs.job is text');
select col_type_is('public', 'ingest_runs', 'started_at', 'timestamp with time zone', 'ingest_runs.started_at is timestamp with time zone');
select col_type_is('public', 'ingest_runs', 'finished_at', 'timestamp with time zone', 'ingest_runs.finished_at is timestamp with time zone');
select col_type_is('public', 'ingest_runs', 'status', 'text', 'ingest_runs.status is text');
select col_type_is('public', 'ingest_runs', 'rows_written', 'integer', 'ingest_runs.rows_written is integer');
select col_type_is('public', 'ingest_runs', 'error', 'text', 'ingest_runs.error is text');

-- secondary indexes and upsert key for news
select col_is_unique('public', 'news_items', array['url'], 'news_items.url is unique');
select col_is_unique('public', 'market_events', array['event_date', 'title'], 'market_events (event_date, title) is unique');
select is(
    (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'news_items_published_at_idx'),
    'CREATE INDEX news_items_published_at_idx ON public.news_items USING btree (published_at DESC)',
    'news_items indexed on published_at desc'
);
select is(
    (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'market_events_event_date_idx'),
    'CREATE INDEX market_events_event_date_idx ON public.market_events USING btree (event_date DESC)',
    'market_events indexed on event_date desc'
);
select is(
    (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'ingest_runs_job_started_at_idx'),
    'CREATE INDEX ingest_runs_job_started_at_idx ON public.ingest_runs USING btree (job, started_at DESC)',
    'ingest_runs indexed on (job, started_at desc)'
);

select * from finish();
rollback;
