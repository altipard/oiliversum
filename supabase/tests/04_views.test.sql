begin;
select plan(30);

-- synthetic fixtures far in the future, real data cannot interfere
-- week 2099-01-12: window 2099-01-05 .. 2099-01-11
insert into public.crude_prices (date, benchmark, price_usd_bbl, source) values
    ('2099-01-06', 'brent', 80, 'fred'),
    ('2099-01-07', 'brent', 80, 'fred'),
    ('2099-01-08', 'brent', 500, 'fred'),  -- no fx: not counted
    ('2099-01-09', 'wti', 500, 'fred'),    -- wti: ignored
    ('2099-01-12', 'brent', 999, 'fred'),  -- week_date itself: outside window
    ('2099-01-04', 'brent', 999, 'fred');  -- week_date - 8: outside window
insert into public.fx_rates (date, pair, rate) values
    ('2099-01-06', 'EURUSD', 1.25),
    ('2099-01-07', 'EURUSD', 1.25),
    ('2099-01-09', 'EURUSD', 1.25),
    ('2099-01-10', 'EURUSD', 1.25),        -- fx without brent: not counted
    ('2099-01-12', 'EURUSD', 1.25),
    ('2099-01-04', 'EURUSD', 1.25);
-- week 2099-03-02 has no trading days at all
insert into public.fuel_prices (week_date, country_code, fuel_type, eur_1000l_with_tax, eur_1000l_without_tax) values
    ('2099-01-12', 'DE', 'euro95', 1800.00, 1400.00),
    ('2099-01-12', 'DE', 'diesel', 1700.00, null),
    ('2099-01-12', 'FR', 'euro95', null, 1500.00),
    ('2099-01-12', 'NL', 'euro95', 0, 0),
    ('2099-03-02', 'DE', 'euro95', 1800.00, 1400.00);

-- structure
select has_view('public', 'crude_weekly', 'crude_weekly exists');
select has_view('public', 'fuel_price_breakdown', 'fuel_price_breakdown exists');
select columns_are('public', 'crude_weekly',
    array['week_date', 'brent_usd_bbl', 'eurusd', 'brent_eur_1000l', 'trading_days']);
select columns_are('public', 'fuel_price_breakdown',
    array['week_date', 'country_code', 'fuel_type', 'eur_1000l_with_tax', 'eur_1000l_without_tax',
          'tax_eur_1000l', 'crude_eur_1000l', 'margin_eur_1000l', 'crude_share']);

select ok(
    'security_invoker=true' = any (select unnest(reloptions) from pg_class where oid = 'public.crude_weekly'::regclass),
    'crude_weekly is security_invoker');
select ok(
    'security_invoker=true' = any (select unnest(reloptions) from pg_class where oid = 'public.fuel_price_breakdown'::regclass),
    'fuel_price_breakdown is security_invoker');

select is(
    (select count(*)::int from pg_attribute a
      where a.attrelid = 'public.crude_weekly'::regclass and a.attnum > 0
        and col_description(a.attrelid, a.attnum) is null),
    0, 'every crude_weekly column has a comment');
select is(
    (select count(*)::int from pg_attribute a
      where a.attrelid = 'public.fuel_price_breakdown'::regclass and a.attnum > 0
        and col_description(a.attrelid, a.attnum) is null),
    0, 'every fuel_price_breakdown column has a comment');

-- crude_weekly values
select is((select count(*)::int from public.crude_weekly where week_date >= '2099-01-01'), 1,
    'week without trading days is missing in crude_weekly');
select is((select trading_days::int from public.crude_weekly where week_date = '2099-01-12'), 2,
    'only days with brent and fx count');
select is((select brent_usd_bbl from public.crude_weekly where week_date = '2099-01-12'), 80.0000::numeric,
    'brent_usd_bbl ignores wti and days outside the window');
select is((select eurusd from public.crude_weekly where week_date = '2099-01-12'), 1.250000::numeric,
    'eurusd averaged over counted days');
select is((select brent_eur_1000l from public.crude_weekly where week_date = '2099-01-12'), 402.55::numeric,
    'brent 80 USD at 1.25 is 402.55 EUR per 1000 l');

-- anon access
set local role anon;
select isnt_empty($$select * from public.crude_weekly where week_date = '2099-01-12'$$, 'anon can select crude_weekly');
select isnt_empty($$select * from public.fuel_price_breakdown where week_date = '2099-01-12'$$, 'anon can select fuel_price_breakdown');
reset role;
-- joined views are not auto-updatable, so an insert fails before the privilege check; test the grant itself
select ok(not has_table_privilege('anon', 'public.crude_weekly', 'insert'), 'anon cannot insert crude_weekly');
select ok(not has_table_privilege('anon', 'public.fuel_price_breakdown', 'insert'), 'anon cannot insert fuel_price_breakdown');

-- fuel_price_breakdown values
select is((select count(*)::int from public.fuel_price_breakdown where week_date >= '2099-01-01'), 4,
    'all fuel_prices rows of a crude week appear, NULL inputs are kept');
select is((select count(*)::int from public.fuel_price_breakdown where week_date = '2099-03-02'), 0,
    'week without crude data is missing in fuel_price_breakdown');

select is((select tax_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'euro95'), 400.00::numeric, 'tax');
select is((select crude_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'euro95'), 402.55::numeric, 'crude');
select is((select margin_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'euro95'), 997.45::numeric, 'margin');
select is((select crude_share from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'euro95'), 0.2236::numeric, 'crude_share');

select is((select tax_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'diesel'), null::numeric, 'NULL without_tax gives NULL tax');
select is((select margin_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'diesel'), null::numeric, 'NULL without_tax gives NULL margin');
select is((select crude_share from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'diesel'), 0.2368::numeric, 'crude_share independent of without_tax');
select is((select crude_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'DE' and fuel_type = 'diesel'), 402.55::numeric, 'crude for diesel');

select is((select tax_eur_1000l from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'FR'), null::numeric, 'NULL with_tax gives NULL tax');
select is((select crude_share from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'FR'), null::numeric, 'NULL with_tax gives NULL crude_share');
select is((select crude_share from public.fuel_price_breakdown
            where week_date = '2099-01-12' and country_code = 'NL'), null::numeric, 'zero with_tax gives NULL crude_share');

select * from finish();
rollback;
