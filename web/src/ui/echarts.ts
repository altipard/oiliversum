// Tree-shaken ECharts build with only the parts this page uses.
import * as echarts from 'echarts/core';
import { LineChart, MapChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  MapChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export { echarts };
export type EChartsType = echarts.EChartsType;

/** Chart instance that resizes with its container. */
export function initChart(el: HTMLElement): EChartsType {
  const chart = echarts.init(el, undefined, { renderer: 'canvas' });
  new ResizeObserver(() => chart.resize()).observe(el);
  return chart;
}
