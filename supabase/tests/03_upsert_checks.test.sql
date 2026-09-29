begin;
select plan(29);

set local role service_role;

-- upserts on the contract conflict keys: second run updates, no duplicate

select lives_ok($$insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-28', 'brent', 70, 'fred')
    on conflict (benchmark, date) do update set price_usd_bbl = excluded.price_usd_bbl, source = excluded.source$$, 'crude_prices upsert 1');
select lives_ok($$insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-28', 'brent', 71.5, 'eia')
    on conflict (benchmark, date) do update set price_usd_bbl = excluded.price_usd_bbl, source = excluded.source$$, 'crude_prices upsert 2');
select is((select count(*)::int from public.crude_prices), 1, 'crude_prices has one row');
select is((select price_usd_bbl from public.crude_prices), 71.5000::numeric(10,4), 'crude_prices row updated');

select lives_ok($$insert into public.fx_rates (date, pair, rate) values ('2026-09-28', 'EURUSD', 1.1)
    on conflict (pair, date) do update set rate = excluded.rate$$, 'fx_rates upsert 1');
select lives_ok($$insert into public.fx_rates (date, pair, rate) values ('2026-09-28', 'EURUSD', 1.2)
    on conflict (pair, date) do update set rate = excluded.rate$$, 'fx_rates upsert 2');
select is((select count(*)::int from public.fx_rates), 1, 'fx_rates has one row');
select is((select rate from public.fx_rates), 1.2::numeric(12,6), 'fx_rates row updated');

select lives_ok($$insert into public.fuel_prices (week_date, country_code, fuel_type, eur_1000l_with_tax) values ('2026-09-28', 'GR', 'diesel', 1600)
    on conflict (country_code, fuel_type, week_date) do update set eur_1000l_with_tax = excluded.eur_1000l_with_tax$$, 'fuel_prices upsert 1');
select lives_ok($$insert into public.fuel_prices (week_date, country_code, fuel_type, eur_1000l_with_tax) values ('2026-09-28', 'GR', 'diesel', 1650)
    on conflict (country_code, fuel_type, week_date) do update set eur_1000l_with_tax = excluded.eur_1000l_with_tax$$, 'fuel_prices upsert 2');
select is((select count(*)::int from public.fuel_prices), 1, 'fuel_prices has one row');
select is((select eur_1000l_with_tax from public.fuel_prices), 1650.00::numeric(10,2), 'fuel_prices row updated');

select lives_ok($$insert into public.news_items (source, title, url) values ('feed', 'old title', 'https://example.org/n')
    on conflict (url) do update set title = excluded.title$$, 'news_items upsert 1');
select lives_ok($$insert into public.news_items (source, title, url) values ('feed', 'new title', 'https://example.org/n')
    on conflict (url) do update set title = excluded.title$$, 'news_items upsert 2');
select is((select count(*)::int from public.news_items), 1, 'news_items has one row');
select is((select title from public.news_items), 'new title', 'news_items row updated');

select lives_ok($$insert into public.country_stats (country_code, fuel_type, lag_weeks, asymmetry) values ('DE', 'euro95', 1, 0.1)
    on conflict (country_code, fuel_type) do update set lag_weeks = excluded.lag_weeks, asymmetry = excluded.asymmetry$$, 'country_stats upsert 1');
select lives_ok($$insert into public.country_stats (country_code, fuel_type, lag_weeks, asymmetry) values ('DE', 'euro95', 3, 0.2)
    on conflict (country_code, fuel_type) do update set lag_weeks = excluded.lag_weeks, asymmetry = excluded.asymmetry$$, 'country_stats upsert 2');
select is((select count(*)::int from public.country_stats), 1, 'country_stats has one row');
select is((select lag_weeks from public.country_stats), 3, 'country_stats row updated');

-- CHECK constraints reject invalid values (check_violation)

select throws_ok($$insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-28', 'urals', 1, 'fred')$$, '23514', null, 'invalid benchmark rejected');
select throws_ok($$insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-28', 'wti', 1, 'yahoo')$$, '23514', null, 'invalid crude source rejected');
select throws_ok($$insert into public.fx_rates (date, pair, rate) values ('2026-09-28', 'eurusd', 1)$$, '23514', null, 'invalid fx pair rejected');
select throws_ok($$insert into public.fuel_prices (week_date, country_code, fuel_type) values ('2026-09-28', 'DE', 'lpg')$$, '23514', null, 'invalid fuel_prices.fuel_type rejected');
select throws_ok($$insert into public.country_stats (country_code, fuel_type) values ('DE', 'lpg')$$, '23514', null, 'invalid country_stats.fuel_type rejected');
select throws_ok($$insert into public.news_items (source, title, url, direction) values ('x', 'x', 'https://example.org/d', 'sideways')$$, '23514', null, 'invalid direction rejected');
select throws_ok($$insert into public.news_items (source, title, url, relevance) values ('x', 'x', 'https://example.org/r1', 1.01)$$, '23514', null, 'relevance above 1 rejected');
select throws_ok($$insert into public.news_items (source, title, url, relevance) values ('x', 'x', 'https://example.org/r2', -0.01)$$, '23514', null, 'relevance below 0 rejected');
select throws_ok($$insert into public.ingest_runs (job, status) values ('x', 'done')$$, '23514', null, 'invalid ingest status rejected');

select * from finish();
rollback;
