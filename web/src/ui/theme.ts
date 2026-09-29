/** Chart colours read from the CSS variables, so charts follow light/dark mode. */
export interface ChartTheme {
  text: string;
  muted: string;
  border: string;
  surface: string;
  brent: string;
  up: string;
  down: string;
  neutral: string;
  mapEmpty: string;
  mapLow: string;
  mapHigh: string;
  series: string[];
  font: string;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  return {
    text: v('--text'),
    muted: v('--muted'),
    border: v('--border'),
    surface: v('--surface'),
    brent: v('--brent'),
    up: v('--up'),
    down: v('--down'),
    neutral: v('--neutral'),
    mapEmpty: v('--map-empty'),
    mapLow: v('--map-low'),
    mapHigh: v('--map-high'),
    series: [v('--series-1'), v('--series-2'), v('--series-3'), v('--series-4')],
    font: v('--font'),
  };
}

/** Calls `listener` whenever the colour scheme switches. */
export function onThemeChange(listener: () => void): void {
  window.matchMedia(DARK_QUERY).addEventListener('change', listener);
}

/** Shared tooltip styling. */
export function tooltipStyle(t: ChartTheme): Record<string, unknown> {
  return {
    backgroundColor: t.surface,
    borderColor: t.border,
    textStyle: { color: t.text, fontFamily: t.font },
    confine: true,
  };
}
