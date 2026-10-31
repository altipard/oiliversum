import type { MarketEvent, MarketEventCategory } from '../data/types';
import { shiftDate } from './brent';
import type { Point } from './series';

export const CATEGORY_LABEL: Record<MarketEventCategory, string> = {
  geopolitik: 'Geopolitik',
  opec: 'OPEC+',
  sanktion: 'Sanktionen',
  angebot: 'Angebot',
  makro: 'Makro',
};

export interface EventMarker {
  date: string;
  value: number;
  item: MarketEvent;
}

/**
 * Places each event on the Brent line: at the value of the last week on or
 * before its date. Events older than the line are dropped.
 */
export function eventMarkers(items: readonly MarketEvent[], line: readonly Point[]): EventMarker[] {
  if (line.length === 0) return [];
  const first = line[0]![0];
  const markers: EventMarker[] = [];
  for (const item of items) {
    const date = item.event_date?.slice(0, 10);
    if (!date || date < first) continue;
    let value = line[0]![1];
    for (const [d, v] of line) {
      if (d > date) break;
      value = v;
    }
    markers.push({ date, value, item });
  }
  return markers;
}

/** Events within ±`days` of a date, e.g. for the tooltip of a weekly point. */
export function eventsNear(items: readonly MarketEvent[], date: string, days: number): MarketEvent[] {
  const from = shiftDate(date, -days);
  const to = shiftDate(date, days);
  return items.filter((e) => {
    const d = e.event_date?.slice(0, 10);
    return d != null && d >= from && d <= to;
  });
}

/** Newest first, for the sidebar list. */
export function eventsNewestFirst(items: readonly MarketEvent[]): MarketEvent[] {
  return [...items].sort((a, b) => b.event_date.localeCompare(a.event_date));
}

/** Visible window of ±`weeks` around `date`, clamped to `earliest`. */
export function focusWindow(date: string, weeks: number, earliest: string): { start: string; end: string } {
  const start = shiftDate(date, -7 * weeks);
  return { start: start < earliest ? earliest : start, end: shiftDate(date, 7 * weeks) };
}

/** Stable identity of an event, used to match the list selection to the chart. */
export function isEventSelected(event: MarketEvent, selected: MarketEvent | null): boolean {
  return selected != null && selected.event_date === event.event_date && selected.title === event.title;
}
