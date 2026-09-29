-- Views for the crude share of pump prices.
-- security_invoker: the views run with the caller's rights, so RLS of the base tables applies.

-- ---------------------------------------------------------------------------
-- crude_weekly: Brent per bulletin week in EUR per 1000 l
-- ---------------------------------------------------------------------------
create view public.crude_weekly with (security_invoker = true) as
with weeks as (
    select distinct week_date from public.fuel_prices
),
daily as (
    select
        c.date,
        c.price_usd_bbl,
        f.rate,
        c.price_usd_bbl / f.rate as eur_bbl
    from public.crude_prices c
    join public.fx_rates f on f.date = c.date and f.pair = 'EURUSD'
    where c.benchmark = 'brent'
)
select
    w.week_date,
    round(avg(d.price_usd_bbl), 4) as brent_usd_bbl,
    round(avg(d.rate), 6) as eurusd,
    round(avg(d.eur_bbl) / 158.987294928 * 1000, 2) as brent_eur_1000l,
    count(*) as trading_days
from weeks w
join daily d on d.date between w.week_date - 7 and w.week_date - 1
group by w.week_date;

comment on view public.crude_weekly is 'Brent crude per bulletin week in EUR per 1000 l. Mean of daily USD/EUR-converted quotes in the 7 days before week_date (week_date - 7 to week_date - 1); only days with Brent and EURUSD count. Weeks without such a day are omitted.';
comment on column public.crude_weekly.week_date is 'Bulletin reference date (Monday); the window ends the day before.';
comment on column public.crude_weekly.brent_usd_bbl is 'Mean Brent spot price in USD per barrel over the window.';
comment on column public.crude_weekly.eurusd is 'Mean EURUSD rate over the window, USD per 1 EUR.';
comment on column public.crude_weekly.brent_eur_1000l is 'Mean Brent price in EUR per 1000 l (daily USD/rate, averaged, 158.987294928 l per barrel).';
comment on column public.crude_weekly.trading_days is 'Number of days in the window with both Brent and EURUSD (count).';

-- ---------------------------------------------------------------------------
-- fuel_price_breakdown: pump price split into crude, taxes and margin
-- ---------------------------------------------------------------------------
create view public.fuel_price_breakdown with (security_invoker = true) as
select
    p.week_date,
    p.country_code,
    p.fuel_type,
    p.eur_1000l_with_tax,
    p.eur_1000l_without_tax,
    p.eur_1000l_with_tax - p.eur_1000l_without_tax as tax_eur_1000l,
    cw.brent_eur_1000l as crude_eur_1000l,
    p.eur_1000l_without_tax - cw.brent_eur_1000l as margin_eur_1000l,
    round(cw.brent_eur_1000l / nullif(p.eur_1000l_with_tax, 0), 4) as crude_share
from public.fuel_prices p
join public.crude_weekly cw on cw.week_date = p.week_date;

comment on view public.fuel_price_breakdown is 'Consumer fuel price per country, fuel type and bulletin week, split into crude, taxes and margin (EUR per 1000 l). Only weeks with a crude_weekly row.';
comment on column public.fuel_price_breakdown.week_date is 'Bulletin reference date (Monday).';
comment on column public.fuel_price_breakdown.country_code is 'ISO 3166-1 alpha-2 country code (Greece is GR, not EL).';
comment on column public.fuel_price_breakdown.fuel_type is 'Fuel type: euro95 (Euro-super 95) or diesel.';
comment on column public.fuel_price_breakdown.eur_1000l_with_tax is 'Consumer price in EUR per 1000 l incl. duties and taxes.';
comment on column public.fuel_price_breakdown.eur_1000l_without_tax is 'Price in EUR per 1000 l excl. duties and taxes.';
comment on column public.fuel_price_breakdown.tax_eur_1000l is 'Duties and taxes in EUR per 1000 l (with tax minus without tax).';
comment on column public.fuel_price_breakdown.crude_eur_1000l is 'Brent crude cost in EUR per 1000 l (crude_weekly.brent_eur_1000l).';
comment on column public.fuel_price_breakdown.margin_eur_1000l is 'Gross spread in EUR per 1000 l (price without tax minus crude): refining, logistics, trading and blending. Not profit.';
comment on column public.fuel_price_breakdown.crude_share is 'Crude cost as a fraction of the price incl. tax, 0 to 1 (dimensionless); NULL if the price is NULL or 0.';

-- ---------------------------------------------------------------------------
-- Access control: same as the base tables, read-only
-- ---------------------------------------------------------------------------
revoke all on public.crude_weekly, public.fuel_price_breakdown from anon, authenticated;
grant select on public.crude_weekly, public.fuel_price_breakdown to anon, authenticated;
