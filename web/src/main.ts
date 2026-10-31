import './style.css';
import {
  fetchCountrySeries,
  fetchCrudeWeekly,
  fetchEventsSince,
  fetchNewsSince,
  fetchSummary,
  type LatestWeeks,
} from './data/queries';
import type { BreakdownRow, CountryStatRow, CrudeWeeklyRow, FuelType, MarketEvent, NewsItem } from './data/types';
import { brentHeadline } from './lib/brent';
import { countryNameDe } from './lib/countries';
import { eventsNewestFirst, focusWindow, isEventSelected } from './lib/events';
import { formatDate } from './lib/format';
import { buildCountryRows, nextSort, sortCountryRows, type SortDir, type SortKey, type TaxMode } from './lib/table';
import {
  addCountry,
  NEWS_MIN_RELEVANCE,
  PERIODS,
  periodStart,
  removeCountry,
  type Period,
} from './lib/timeline';
import { byId, SectionStatus, segmented } from './ui/dom';
import { renderEvents } from './ui/events';
import { renderHeadline } from './ui/header';
import { FUEL_LABEL, loadEuropeMap, MapView } from './ui/map';
import { renderTable } from './ui/table';
import { onThemeChange, readTheme } from './ui/theme';
import { renderChips, TimeseriesView } from './ui/timeseries';

/** Full backfill start; the chart loads the whole history so any event is reachable. */
const HISTORY_FROM = '2015-01-01';
/** Half-width of the window the chart zooms to around a selected event. */
const FOCUS_WEEKS = 8;

interface State {
  fuel: FuelType;
  tax: TaxMode;
  period: Period;
  selected: readonly string[];
  sort: { key: SortKey; dir: SortDir };
  /** Chart window override after picking an event; null = use `period`. */
  focus: { start: string; end: string } | null;
  focusedEvent: MarketEvent | null;
}

const state: State = {
  fuel: 'euro95',
  tax: 'with',
  period: '6M',
  selected: ['DE', 'FR', 'IT', 'PL'],
  sort: { key: 'price', dir: 'desc' },
  focus: null,
  focusedEvent: null,
};

// Loaded data; null = not loaded (yet).
let weeks: LatestWeeks | null = null;
let stats: CountryStatRow[] = [];
let crude: CrudeWeeklyRow[] | null = null;
let seriesFrom: string | null = null;
let newsOnAxis: NewsItem[] = [];
let eventsOnAxis: MarketEvent[] = [];
let mapReady = false;
const countrySeries = new Map<string, BreakdownRow[]>();

let theme = readTheme();

const sections = {
  headline: byId('headline'),
  map: byId('map-section'),
  series: byId('series-section'),
  table: byId('table-section'),
  events: byId('events-section'),
};
const status = {
  headline: new SectionStatus(sections.headline),
  map: new SectionStatus(sections.map),
  series: new SectionStatus(sections.series),
  table: new SectionStatus(sections.table),
  events: new SectionStatus(sections.events),
};

const mapView = new MapView(byId('map-chart'), (code) => void selectCountry(code));
const seriesView = new TimeseriesView(byId('series-chart'));

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function viewLabel(): string {
  return `${FUEL_LABEL[state.fuel]} · ${state.tax === 'with' ? 'inkl. Steuern' : 'ohne Steuern'}`;
}

function setMeta(section: HTMLElement, text: string): void {
  const el = section.querySelector<HTMLElement>('[data-meta]');
  if (el) el.textContent = text;
}

// ---------------------------------------------------------------------------
// Rendering from state + loaded data
// ---------------------------------------------------------------------------

function renderMap(): void {
  if (!weeks?.latestWeek || !mapReady) return;
  mapView.render(weeks.latest, state.fuel, state.tax, theme);
  setMeta(sections.map, `Woche vom ${formatDate(weeks.latestWeek)} · ${viewLabel()}`);
}

function renderCountryTable(): void {
  if (!weeks?.latestWeek) return;
  const rows = buildCountryRows(weeks.latest, weeks.previous, stats, state.fuel, state.tax);
  renderTable(
    byId<HTMLTableElement>('country-table'),
    sortCountryRows(rows, state.sort.key, state.sort.dir),
    state.sort,
    state.tax,
    state.selected,
    {
      onSort: (key) => {
        state.sort = nextSort(state.sort, key);
        renderCountryTable();
      },
      onSelect: (code) => void selectCountry(code),
    },
  );
  setMeta(sections.table, `Woche vom ${formatDate(weeks.latestWeek)} · ${viewLabel()}`);
}

function renderSeries(): void {
  renderChips(byId('selected-countries'), state.selected, theme, (code) => {
    state.selected = removeCountry(state.selected, code);
    renderSeries();
    renderCountryTable();
  });
  if (!crude) return;
  const end = crude.at(-1)?.week_date ?? weeks?.latestWeek ?? today();
  seriesView.render(
    {
      crude,
      countries: countrySeries,
      selected: state.selected.filter((c) => countrySeries.has(c)),
      fuel: state.fuel,
      tax: state.tax,
      window: state.focus ?? { start: periodStart(end, state.period), end },
      news: newsOnAxis,
      events: eventsOnAxis,
      selectedEvent: state.focusedEvent,
    },
    theme,
  );
}

function renderEventsList(): void {
  renderEvents(byId('events-list'), eventsNewestFirst(eventsOnAxis), state.focusedEvent, selectEvent);
}

/** Zoom the chart onto the event; picking the same event again returns to the period. */
function selectEvent(event: MarketEvent): void {
  if (isEventSelected(event, state.focusedEvent)) {
    state.focusedEvent = null;
    state.focus = null;
  } else {
    state.focusedEvent = event;
    state.focus = focusWindow(event.event_date, FOCUS_WEEKS, HISTORY_FROM);
  }
  renderSeries();
  renderEventsList();
  if (window.matchMedia('(max-width: 999px)').matches) {
    sections.series.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderAll(): void {
  renderMap();
  renderCountryTable();
  renderSeries();
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadHeadline(): Promise<void> {
  status.headline.loading();
  const body = sections.headline.querySelector<HTMLElement>('[data-body]')!;
  try {
    const summary = await fetchSummary();
    status.headline.clear();
    renderHeadline(body, brentHeadline(summary.brent, summary.fx), summary.latestBulletin);
  } catch (err) {
    status.headline.error('Der Brent-Preis', err);
    renderHeadline(body, null, null);
  }
}

async function loadMapAndTable(): Promise<void> {
  status.map.loading();
  status.table.loading();
  const [geo, latest] = await Promise.allSettled([loadEuropeMap(), fetchSummary()]);
  if (latest.status === 'fulfilled') {
    weeks = latest.value.weeks;
    stats = latest.value.countryStats;
  }
  mapReady = geo.status === 'fulfilled';

  if (latest.status === 'rejected') {
    status.map.error('Die Preise der letzten Bulletin-Woche', latest.reason);
    status.table.error('Die Preise der letzten Bulletin-Woche', latest.reason);
    return;
  }
  if (!weeks?.latestWeek) {
    status.map.loading('Noch keine Bulletin-Daten vorhanden.');
    status.table.loading('Noch keine Bulletin-Daten vorhanden.');
    return;
  }
  if (geo.status === 'rejected') status.map.error('Die Kartengeometrie', geo.reason);
  else status.map.clear();
  status.table.clear();
  renderMap();
  renderCountryTable();
}

async function loadSeries(): Promise<void> {
  status.series.loading();
  status.events.loading();
  seriesFrom = HISTORY_FROM;
  const codes = [...state.selected];
  const [crudeRes, newsRes, eventsRes, countryRes] = await Promise.all([
    fetchCrudeWeekly(HISTORY_FROM).then(
      (rows) => ({ ok: true as const, rows }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    fetchNewsSince(HISTORY_FROM, NEWS_MIN_RELEVANCE).catch(() => null),
    fetchEventsSince(HISTORY_FROM).catch(() => null),
    Promise.allSettled(codes.map((code) => fetchCountrySeries(code, HISTORY_FROM))),
  ]);
  if (crudeRes.ok) crude = crudeRes.rows;
  if (newsRes) newsOnAxis = newsRes;
  if (eventsRes) {
    eventsOnAxis = eventsRes;
    status.events.clear();
  } else {
    status.events.error('Die Ereignisse', 'Abfrage fehlgeschlagen');
  }
  const failed: string[] = [];
  countryRes.forEach((res, i) => {
    const code = codes[i]!;
    if (res.status === 'fulfilled') countrySeries.set(code, res.value);
    else failed.push(countryNameDe(code));
  });
  if (!crudeRes.ok) {
    status.series.error('Die Brent-Zeitreihe', crudeRes.err);
  } else if (failed.length > 0) {
    status.series.error(`Die Zeitreihe für ${failed.join(', ')}`, 'Abfrage fehlgeschlagen');
  } else {
    status.series.clear();
  }
  renderSeries();
  renderEventsList();
}

async function selectCountry(code: string): Promise<void> {
  if (addCountry(state.selected, code) === state.selected) return;
  if (!countrySeries.has(code) && seriesFrom) {
    status.series.loading(`Lädt ${countryNameDe(code)} …`);
    try {
      countrySeries.set(code, await fetchCountrySeries(code, seriesFrom));
      status.series.clear();
    } catch (err) {
      status.series.error(`Die Zeitreihe für ${countryNameDe(code)}`, err, crude?.at(-1)?.week_date ?? null);
      return;
    }
  }
  // Re-check: the selection may have changed while loading.
  state.selected = addCountry(state.selected, code);
  renderSeries();
  renderCountryTable();
}

// ---------------------------------------------------------------------------
// Controls and start
// ---------------------------------------------------------------------------

function setupControls(): void {
  segmented<FuelType>(
    byId('fuel-toggle'),
    [
      { value: 'euro95', label: 'Super 95' },
      { value: 'diesel', label: 'Diesel' },
    ],
    state.fuel,
    (fuel) => {
      state.fuel = fuel;
      renderAll();
    },
  );
  segmented<TaxMode>(
    byId('tax-toggle'),
    [
      { value: 'with', label: 'mit Steuern' },
      { value: 'without', label: 'ohne Steuern' },
    ],
    state.tax,
    (tax) => {
      state.tax = tax;
      renderAll();
    },
  );
  segmented<Period>(
    byId('period-toggle'),
    PERIODS.map((p) => ({ value: p, label: p })),
    state.period,
    (period) => {
      state.period = period;
      state.focus = null;
      state.focusedEvent = null;
      renderSeries();
      renderEventsList();
    },
  );
  onThemeChange(() => {
    theme = readTheme();
    renderAll();
  });
}

async function main(): Promise<void> {
  setupControls();
  renderSeries();
  await Promise.all([
    loadHeadline(),
    loadMapAndTable().then(() => loadSeries()),
  ]);
}

main().catch((err: unknown) => {
  const banner = document.getElementById('config-error');
  if (banner) {
    banner.textContent = `Die Seite konnte nicht gestartet werden: ${err instanceof Error ? err.message : String(err)}`;
    banner.hidden = false;
  }
});
