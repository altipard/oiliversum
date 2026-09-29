import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlasUrl from 'world-atlas/countries-50m.json?url';
import type { BreakdownRow, FuelType } from '../data/types';
import { countryNameDe } from '../lib/countries';
import { escapeHtml, formatEurLiter, formatShare, perLiter } from '../lib/format';
import { cropToEurope, type GeoCollection } from '../lib/geo';
import { priceOf, taxShare, type TaxMode } from '../lib/table';
import { initChart, echarts, type EChartsType } from './echarts';
import { tooltipStyle, type ChartTheme } from './theme';

const MAP_NAME = 'europe';

export const FUEL_LABEL: Record<FuelType, string> = { euro95: 'Super 95', diesel: 'Diesel' };

/** Loads Natural Earth country shapes (world-atlas), crops them to Europe and registers the map. */
export async function loadEuropeMap(): Promise<void> {
  const res = await fetch(atlasUrl);
  if (!res.ok) throw new Error(`Kartendaten HTTP ${res.status}`);
  const topo = (await res.json()) as Topology<{ countries: GeometryCollection }>;
  const countries = feature(topo, topo.objects.countries) as unknown as GeoCollection;
  // ECharts accepts plain GeoJSON; its own typing is narrower than ours.
  echarts.registerMap(MAP_NAME, cropToEurope(countries) as unknown as Parameters<typeof echarts.registerMap>[1]);
}

interface MapDatum {
  name: string;
  value: number;
  row: BreakdownRow;
}

function tooltipHtml(d: MapDatum, tax: TaxMode): string {
  const r = d.row;
  const lines = [
    `<strong>${escapeHtml(countryNameDe(r.country_code))}</strong>`,
    `${tax === 'with' ? 'Preis inkl. Steuern' : 'Preis ohne Steuern'}: <strong>${formatEurLiter(d.value)}</strong>`,
    `Rohöl (Brent): ${formatEurLiter(perLiter(r.crude_eur_1000l))} (${formatShare(r.crude_share)})`,
    `Marge, Raffinerie, Logistik: ${formatEurLiter(perLiter(r.margin_eur_1000l))}`,
    `Steuern und Abgaben: ${formatEurLiter(perLiter(r.tax_eur_1000l))} (${formatShare(taxShare(r))})`,
  ];
  if (tax === 'without') lines.push(`Preis inkl. Steuern: ${formatEurLiter(perLiter(r.eur_1000l_with_tax))}`);
  return lines.join('<br>');
}

export class MapView {
  private readonly chart: EChartsType;

  constructor(el: HTMLElement, onCountryClick: (code: string) => void) {
    this.chart = initChart(el);
    this.chart.on('click', (p) => {
      const d = p.data as unknown as MapDatum | undefined;
      if (d?.row) onCountryClick(d.row.country_code);
    });
  }

  render(rows: readonly BreakdownRow[], fuel: FuelType, tax: TaxMode, theme: ChartTheme): void {
    const data: MapDatum[] = [];
    for (const row of rows) {
      if (row.fuel_type !== fuel) continue;
      const value = perLiter(priceOf(row, tax));
      if (value != null) data.push({ name: row.country_code, value, row });
    }
    const values = data.map((d) => d.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    this.chart.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: theme.font },
        tooltip: {
          ...tooltipStyle(theme),
          trigger: 'item',
          formatter: (p: { data?: MapDatum; name: string }) =>
            p.data?.row ? tooltipHtml(p.data, tax) : `${escapeHtml(countryNameDe(p.name))}<br>keine Daten`,
        },
        visualMap: {
          type: 'continuous',
          min,
          max,
          calculable: false,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          itemHeight: 160,
          text: [formatEurLiter(max), formatEurLiter(min)],
          textStyle: { color: theme.text },
          inRange: { color: [theme.mapLow, theme.mapHigh] },
        },
        series: [
          {
            type: 'map',
            map: MAP_NAME,
            roam: false,
            top: 4,
            bottom: 36,
            aspectScale: 0.72,
            selectedMode: false,
            label: { show: false },
            itemStyle: { areaColor: theme.mapEmpty, borderColor: theme.surface, borderWidth: 0.6 },
            // keep the value colour on hover; the tooltip carries the detail
            emphasis: { disabled: true },
            data,
          },
        ],
      },
      { notMerge: true },
    );
  }

  clear(): void {
    this.chart.clear();
  }
}
