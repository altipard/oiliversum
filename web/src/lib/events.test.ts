import { describe, expect, it } from 'vitest';
import type { MarketEvent } from '../data/types';
import { eventMarkers, eventsNear } from './events';

function event(event_date: string, severity = 2): MarketEvent {
  return {
    event_date,
    title: 't',
    category: 'geopolitik',
    direction: 'bullish',
    severity,
    description: null,
    source_url: null,
    tags: [],
  };
}

const line: [string, number][] = [
  ['2026-09-07', 0.5],
  ['2026-09-14', 0.6],
  ['2026-09-21', 0.7],
];

describe('eventMarkers', () => {
  it('puts each event on the Brent value of the last week on or before it', () => {
    const m = eventMarkers([event('2026-09-16'), event('2026-09-14'), event('2026-09-25')], line);
    expect(m.map((x) => [x.date, x.value])).toEqual([
      ['2026-09-16', 0.6],
      ['2026-09-14', 0.6],
      ['2026-09-25', 0.7],
    ]);
  });

  it('drops events before the line or without a usable line', () => {
    expect(eventMarkers([event('2026-09-01')], line)).toEqual([]);
    expect(eventMarkers([event('2026-09-16')], [])).toEqual([]);
  });
});

describe('eventsNear', () => {
  it('finds events within the window around a date', () => {
    const items = [event('2026-09-17'), event('2026-09-19'), event('2026-09-24'), event('2026-09-30')];
    expect(eventsNear(items, '2026-09-21', 3).map((e) => e.event_date)).toEqual(['2026-09-19', '2026-09-24']);
  });
});
