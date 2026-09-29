begin;
select plan(63);

-- RLS enabled everywhere
select ok((select relrowsecurity from pg_class where oid = 'public.crude_prices'::regclass), 'rls on crude_prices');
select ok((select relrowsecurity from pg_class where oid = 'public.fx_rates'::regclass), 'rls on fx_rates');
select ok((select relrowsecurity from pg_class where oid = 'public.fuel_prices'::regclass), 'rls on fuel_prices');
select ok((select relrowsecurity from pg_class where oid = 'public.news_items'::regclass), 'rls on news_items');
select ok((select relrowsecurity from pg_class where oid = 'public.country_stats'::regclass), 'rls on country_stats');
select ok((select relrowsecurity from pg_class where oid = 'public.ingest_runs'::regclass), 'rls on ingest_runs');

select is(
    (select count(*)::int from pg_policies
      where schemaname = 'public'
        and tablename in ('crude_prices', 'fx_rates', 'fuel_prices', 'news_items', 'country_stats', 'ingest_runs')
        and cmd <> 'SELECT'),
    0,
    'no write policies'
);

-- fixture rows, one per table
insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-28', 'brent', 70.1234, 'fred');
insert into public.fx_rates (date, pair, rate) values ('2026-09-28', 'EURUSD', 1.123456);
insert into public.fuel_prices (week_date, country_code, fuel_type, eur_1000l_with_tax) values ('2026-09-28', 'DE', 'euro95', 1750.00);
insert into public.news_items (source, title, url) values ('test', 'title', 'https://example.org/a');
insert into public.country_stats (country_code, fuel_type, lag_weeks, asymmetry) values ('DE', 'diesel', 2, 0.5);
insert into public.ingest_runs (job, status) values ('test', 'running');

-- anon reads
set local role anon;

select isnt_empty('select * from public.crude_prices', 'anon can read crude_prices');
select isnt_empty('select * from public.fx_rates', 'anon can read fx_rates');
select isnt_empty('select * from public.fuel_prices', 'anon can read fuel_prices');
select isnt_empty('select * from public.news_items', 'anon can read news_items');
select isnt_empty('select * from public.country_stats', 'anon can read country_stats');
select isnt_empty('select * from public.ingest_runs', 'anon can read ingest_runs');

-- anon writes fail with insufficient_privilege
select throws_ok($$insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values ('2026-09-29', 'wti', 1, 'eia')$$, '42501', null, 'anon cannot insert crude_prices');
select throws_ok($$update public.crude_prices set price_usd_bbl = 0$$, '42501', null, 'anon cannot update crude_prices');
select throws_ok($$delete from public.crude_prices$$, '42501', null, 'anon cannot delete crude_prices');
select throws_ok($$truncate public.crude_prices$$, '42501', null, 'anon cannot truncate crude_prices');

select throws_ok($$insert into public.fx_rates (date, pair, rate) values ('2026-09-29', 'EURUSD', 1)$$, '42501', null, 'anon cannot insert fx_rates');
select throws_ok($$update public.fx_rates set rate = 0$$, '42501', null, 'anon cannot update fx_rates');
select throws_ok($$delete from public.fx_rates$$, '42501', null, 'anon cannot delete fx_rates');
select throws_ok($$truncate public.fx_rates$$, '42501', null, 'anon cannot truncate fx_rates');

select throws_ok($$insert into public.fuel_prices (week_date, country_code, fuel_type) values ('2026-09-29', 'FR', 'diesel')$$, '42501', null, 'anon cannot insert fuel_prices');
select throws_ok($$update public.fuel_prices set eur_1000l_with_tax = 0$$, '42501', null, 'anon cannot update fuel_prices');
select throws_ok($$delete from public.fuel_prices$$, '42501', null, 'anon cannot delete fuel_prices');
select throws_ok($$truncate public.fuel_prices$$, '42501', null, 'anon cannot truncate fuel_prices');

select throws_ok($$insert into public.news_items (source, title, url) values ('x', 'x', 'https://example.org/b')$$, '42501', null, 'anon cannot insert news_items');
select throws_ok($$update public.news_items set title = 'x'$$, '42501', null, 'anon cannot update news_items');
select throws_ok($$delete from public.news_items$$, '42501', null, 'anon cannot delete news_items');
select throws_ok($$truncate public.news_items$$, '42501', null, 'anon cannot truncate news_items');

select throws_ok($$insert into public.country_stats (country_code, fuel_type) values ('FR', 'euro95')$$, '42501', null, 'anon cannot insert country_stats');
select throws_ok($$update public.country_stats set lag_weeks = 0$$, '42501', null, 'anon cannot update country_stats');
select throws_ok($$delete from public.country_stats$$, '42501', null, 'anon cannot delete country_stats');
select throws_ok($$truncate public.country_stats$$, '42501', null, 'anon cannot truncate country_stats');

select throws_ok($$insert into public.ingest_runs (job, status) values ('x', 'running')$$, '42501', null, 'anon cannot insert ingest_runs');
select throws_ok($$update public.ingest_runs set status = 'failed'$$, '42501', null, 'anon cannot update ingest_runs');
select throws_ok($$delete from public.ingest_runs$$, '42501', null, 'anon cannot delete ingest_runs');
select throws_ok($$truncate public.ingest_runs$$, '42501', null, 'anon cannot truncate ingest_runs');

select throws_ok($$select nextval('public.news_items_id_seq')$$, '42501', null, 'anon cannot advance news_items_id_seq');
select throws_ok($$select nextval('public.ingest_runs_id_seq')$$, '42501', null, 'anon cannot advance ingest_runs_id_seq');

reset role;

-- authenticated holds no write privilege (has_table_privilege is true if any listed privilege is held)
select ok(not has_table_privilege('authenticated', 'public.crude_prices', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write crude_prices');
select ok(not has_table_privilege('authenticated', 'public.fx_rates', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write fx_rates');
select ok(not has_table_privilege('authenticated', 'public.fuel_prices', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write fuel_prices');
select ok(not has_table_privilege('authenticated', 'public.news_items', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write news_items');
select ok(not has_table_privilege('authenticated', 'public.country_stats', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write country_stats');
select ok(not has_table_privilege('authenticated', 'public.ingest_runs', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'authenticated cannot write ingest_runs');

-- anon/authenticated hold nothing but SELECT
select table_privs_are('public', 'crude_prices', 'anon', array['SELECT']);
select table_privs_are('public', 'fx_rates', 'anon', array['SELECT']);
select table_privs_are('public', 'fuel_prices', 'anon', array['SELECT']);
select table_privs_are('public', 'news_items', 'anon', array['SELECT']);
select table_privs_are('public', 'country_stats', 'anon', array['SELECT']);
select table_privs_are('public', 'ingest_runs', 'anon', array['SELECT']);
select table_privs_are('public', 'crude_prices', 'authenticated', array['SELECT']);
select table_privs_are('public', 'fx_rates', 'authenticated', array['SELECT']);
select table_privs_are('public', 'fuel_prices', 'authenticated', array['SELECT']);
select table_privs_are('public', 'news_items', 'authenticated', array['SELECT']);
select table_privs_are('public', 'country_stats', 'authenticated', array['SELECT']);
select table_privs_are('public', 'ingest_runs', 'authenticated', array['SELECT']);

-- service_role keeps full rights
select table_privs_are('public', 'crude_prices', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
select table_privs_are('public', 'fx_rates', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
select table_privs_are('public', 'fuel_prices', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
select table_privs_are('public', 'news_items', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
select table_privs_are('public', 'country_stats', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
select table_privs_are('public', 'ingest_runs', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);

select * from finish();
rollback;
