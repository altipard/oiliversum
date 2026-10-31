-- Curated market events, annotated on the fuel price time series.
-- Editorial reference data seeded here; no ingest job writes to this table.

create table public.market_events (
    id bigint generated always as identity primary key,
    event_date date not null,
    title text not null,
    category text not null check (category in ('geopolitik', 'opec', 'sanktion', 'angebot', 'makro')),
    direction text check (direction in ('bullish', 'bearish', 'neutral')),
    severity smallint not null default 2 check (severity between 1 and 3),
    description text,
    source_url text,
    tags text[] not null default '{}',
    created_at timestamptz not null default now(),
    unique (event_date, title)
);

create index market_events_event_date_idx on public.market_events (event_date desc);

comment on table public.market_events is 'Curated economic and geopolitical events used as annotations on the fuel price time series.';
comment on column public.market_events.event_date is 'Date the event happened.';
comment on column public.market_events.title is 'Short event title shown as a chart annotation.';
comment on column public.market_events.category is 'Event class: geopolitik, opec, sanktion, angebot or makro.';
comment on column public.market_events.direction is 'Expected price impact: bullish, bearish or neutral.';
comment on column public.market_events.severity is 'Editorial weight: 1 minor, 2 notable, 3 major.';
comment on column public.market_events.description is 'Optional one-line explanation.';
comment on column public.market_events.source_url is 'Optional reference link.';
comment on column public.market_events.tags is 'Free-form topic tags.';
comment on column public.market_events.created_at is 'Time the row was first stored.';

-- ---------------------------------------------------------------------------
-- Access control: public read, writes only via service_role
-- ---------------------------------------------------------------------------
alter table public.market_events enable row level security;

create policy "public read" on public.market_events for select to anon, authenticated using (true);

revoke all on public.market_events from anon, authenticated;
grant select on public.market_events to anon, authenticated;

revoke usage, update on sequence public.market_events_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: curated events. Feeds the static export, so every CI run reseeds it.
-- Dates and impact are editorial; source_url is given where a stable reference exists.
-- ---------------------------------------------------------------------------
insert into public.market_events (event_date, title, category, direction, severity, source_url, tags) values
    ('2015-07-14', 'Atomabkommen mit Iran (JCPOA) unterzeichnet', 'sanktion', 'bearish', 2, 'https://en.wikipedia.org/wiki/Joint_Comprehensive_Plan_of_Action', '{iran}'),
    ('2016-01-16', 'Iran-Sanktionen nach dem JCPOA aufgehoben', 'sanktion', 'bearish', 2, null, '{iran}'),
    ('2016-11-30', 'OPEC beschließt erste Förderkürzung seit 2008', 'opec', 'bullish', 2, null, '{opec}'),
    ('2018-05-08', 'USA steigen aus dem Iran-Abkommen aus', 'sanktion', 'bullish', 2, null, '{iran}'),
    ('2018-11-05', 'US-Sanktionen gegen iranisches Öl treten in Kraft', 'sanktion', 'bullish', 2, null, '{iran}'),
    ('2019-05-12', 'Angriffe auf Tanker vor Fujairah', 'geopolitik', 'bullish', 2, null, '{hormus}'),
    ('2019-06-13', 'Angriffe auf Tanker im Golf von Oman', 'geopolitik', 'bullish', 2, null, '{hormus}'),
    ('2019-09-14', 'Drohnenangriff auf Saudi-Aramco-Anlagen Abqaiq und Khurais', 'angebot', 'bullish', 3, 'https://en.wikipedia.org/wiki/Abqaiq%E2%80%93Khurais_attack', '{saudi}'),
    ('2020-01-03', 'US-Tötung von Qasem Soleimani', 'geopolitik', 'bullish', 2, null, '{iran}'),
    ('2020-03-06', 'OPEC+-Verhandlungen scheitern, Preiskrieg Saudi-Arabien und Russland', 'opec', 'bearish', 3, null, '{opec}'),
    ('2020-03-11', 'WHO erklärt COVID-19 zur Pandemie', 'makro', 'bearish', 3, null, '{covid}'),
    ('2020-04-12', 'OPEC+ beschließt Rekordkürzung um 9,7 Mio. Barrel pro Tag', 'opec', 'bullish', 2, null, '{opec}'),
    ('2022-02-24', 'Russischer Angriff auf die Ukraine', 'geopolitik', 'bullish', 3, null, '{russland}'),
    ('2022-03-08', 'USA verbieten den Import russischen Öls', 'sanktion', 'bullish', 2, null, '{russland}'),
    ('2022-05-30', 'EU beschließt Teil-Embargo auf russisches Öl', 'sanktion', 'bullish', 2, null, '{russland}'),
    ('2022-10-05', 'OPEC+ kürzt die Förderung um 2 Mio. Barrel pro Tag', 'opec', 'bullish', 2, null, '{opec}'),
    ('2022-12-05', 'EU-Ölembargo und G7-Preisdeckel für russisches Rohöl', 'sanktion', 'neutral', 2, null, '{russland}'),
    ('2023-04-02', 'OPEC+ überrascht mit Kürzung um 1,16 Mio. Barrel pro Tag', 'opec', 'bullish', 3, null, '{opec}'),
    ('2023-10-07', 'Hamas-Angriff auf Israel', 'geopolitik', 'bullish', 2, null, '{nahost}'),
    ('2023-12-18', 'Huthi-Angriffe auf die Schifffahrt im Roten Meer', 'geopolitik', 'bullish', 2, null, '{huthi}'),
    ('2024-04-13', 'Iran greift Israel mit Drohnen und Raketen an', 'geopolitik', 'bullish', 2, null, '{nahost}'),
    ('2024-06-02', 'OPEC+ verlängert die freiwilligen Kürzungen bis 2025', 'opec', 'bearish', 2, null, '{opec}'),
    ('2024-10-01', 'Iran feuert Raketen auf Israel', 'geopolitik', 'bullish', 1, null, '{nahost}'),
    ('2025-06-13', 'Israel greift Iran an (Zwölftagekrieg)', 'geopolitik', 'bullish', 3, null, '{iran,hormus}'),
    ('2025-06-22', 'USA bombardieren iranische Atomanlagen in Fordow, Natanz und Isfahan', 'geopolitik', 'bullish', 3, null, '{iran}'),
    ('2025-06-24', 'Waffenstillstand zwischen Israel und Iran', 'geopolitik', 'bearish', 2, null, '{iran}'),
    ('2026-02-28', 'US-israelische Luftangriffe auf Iran, Iran schließt die Straße von Hormus', 'geopolitik', 'bullish', 3, 'https://en.wikipedia.org/wiki/2026_Strait_of_Hormuz_crisis', '{iran,hormus}'),
    ('2026-04-13', 'USA verhängen eine Seeblockade gegen iranische Häfen', 'sanktion', 'bullish', 2, 'https://en.wikipedia.org/wiki/2026_United_States_naval_blockade_of_Iran', '{iran,hormus}'),
    ('2026-06-18', 'Straße von Hormus nach Abkommen wieder geöffnet', 'geopolitik', 'bearish', 2, null, '{iran,hormus}'),
    ('2026-07-08', 'Waffenstillstand bricht zusammen, Hormus erneut geschlossen', 'geopolitik', 'bullish', 2, null, '{iran,hormus}'),
    ('2026-09-08', 'US-Angriff auf iranische Tanker bei Kharg Island', 'angebot', 'bullish', 2, null, '{iran,hormus}'),
    ('2026-10-12', 'Huthi-Angriffe auf saudische Flughäfen', 'geopolitik', 'bullish', 1, null, '{huthi,saudi}');
