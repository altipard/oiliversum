import type { BreakdownRow, CrudeWeeklyRow, FuelType, NewsItem } from '../data/types';
import { countryNameDe } from '../lib/countries';
import { brentLine, newsMarkers, priceLine, type NewsMarker } from '../lib/series';
import type { TaxMode } from '../lib/table';
import { newsNear } from '../lib/timeline';
import { seriesTooltipHtml } from '../lib/tooltip';
import { h } from './dom';
import { initChart, type EChartsType } from './echarts';
import { tooltipStyle, type ChartTheme } from './theme';

const BRENT_NAME = 'Brent (Rohöl)';
const NEWS_NAME = 'Meldungen';

export interface SeriesInput {
  crude: readonly CrudeWeeklyRow[];
  countries: ReadonlyMap<string, readonly BreakdownRow[]>;
  selected: readonly string[];
  fuel: FuelType;
  tax: TaxMode;
  from: string;
  news: readonly NewsItem[];
}

interface AxisParam {
  seriesName: string;
  seriesType: string;
  marker: string;
  value: [string, number];
  axisValue: number | string;
}

function directionColor(item: NewsItem, t: ChartTheme): string {
  if (item.direction === 'bullish') return t.up;
  if (item.direction === 'bearish') return t.down;
  return t.neutral;
}

export function countryColor(selected: readonly string[], code: string, t: ChartTheme): string {
  const i = selected.indexOf(code);
  return t.series[i % t.series.length] ?? t.text;
}

export class TimeseriesView {
  private readonly chart: EChartsType;

  constructor(el: HTMLElement) {
    this.chart = initChart(el);
  }

  render(input: SeriesInput, theme: ChartTheme): void {
    const brent = brentLine(input.crude, input.from);
    const markers = newsMarkers(input.news, brent);
    const lines = input.selected.map((code) => ({
      code,
      data: priceLine(input.countries.get(code) ?? [], input.fuel, input.tax, input.from),
    }));

    const tooltipFormatter = (raw: unknown): string => {
      const params = (Array.isArray(raw) ? raw : [raw]) as AxisParam[];
      const first = params[0];
      if (!first) return '';
      const date = new Date(first.axisValue).toISOString().slice(0, 10);
      const values = params
        .filter((p) => p.seriesType === 'line')
        .map((p) => ({ marker: p.marker, name: p.seriesName, value: p.value[1] }));
      return seriesTooltipHtml(date, values, newsNear(input.news, date, 3).slice(0, 3));
    };

    this.chart.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: theme.font, color: theme.text },
        // ECharts 6 equivalent of the deprecated `containLabel: true`
        grid: { left: 8, right: 16, top: 40, bottom: 24, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
        legend: {
          type: 'scroll',
          top: 0,
          textStyle: { color: theme.text },
          pageTextStyle: { color: theme.muted },
          data: [BRENT_NAME, ...input.selected.map(countryNameDe)],
        },
        tooltip: { ...tooltipStyle(theme), trigger: 'axis', formatter: tooltipFormatter },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: theme.border } },
          axisLabel: { color: theme.muted, hideOverlap: true },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          name: '€/l',
          nameTextStyle: { color: theme.muted },
          axisLabel: { color: theme.muted, formatter: (v: number) => v.toFixed(2).replace('.', ',') },
          splitLine: { lineStyle: { color: theme.border } },
        },
        series: [
          {
            name: BRENT_NAME,
            type: 'line',
            data: brent,
            showSymbol: false,
            lineStyle: { type: 'dashed', width: 2, color: theme.brent },
            itemStyle: { color: theme.brent },
          },
          ...lines.map((l) => ({
            name: countryNameDe(l.code),
            type: 'line',
            data: l.data,
            showSymbol: false,
            lineStyle: { width: 2, color: countryColor(input.selected, l.code, theme) },
            itemStyle: { color: countryColor(input.selected, l.code, theme) },
          })),
          {
            name: NEWS_NAME,
            type: 'scatter',
            symbol: 'pin',
            symbolSize: 18,
            data: markers.map((m: NewsMarker) => ({
              value: [m.date, m.value],
              itemStyle: { color: directionColor(m.item, theme) },
            })),
            z: 5,
          },
        ],
      },
      { notMerge: true },
    );
  }
}

/** Chips for the selected countries with a remove button each. */
export function renderChips(
  container: HTMLElement,
  selected: readonly string[],
  theme: ChartTheme,
  onRemove: (code: string) => void,
): void {
  if (selected.length === 0) {
    container.replaceChildren(h('span', { class: 'empty' }, 'Kein Land gewählt. Land in der Tabelle anklicken.'));
    return;
  }
  container.replaceChildren(
    ...selected.map((code) => {
      const swatch = h('span', { class: 'chip-swatch' });
      swatch.style.background = countryColor(selected, code, theme);
      const remove = h('button', { type: 'button', 'aria-label': `${countryNameDe(code)} entfernen` }, '×');
      remove.addEventListener('click', () => onRemove(code));
      return h('span', { class: 'chip' }, swatch, countryNameDe(code), remove);
    }),
  );
}
