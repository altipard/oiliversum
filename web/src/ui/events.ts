import type { MarketEvent, NewsDirection } from '../data/types';
import { CATEGORY_LABEL, isEventSelected } from '../lib/events';
import { formatDate } from '../lib/format';
import { h } from './dom';

const DIRECTION_LABEL: Record<NewsDirection, string> = {
  bullish: 'preistreibend',
  bearish: 'preissenkend',
  neutral: 'neutral',
};

/**
 * Curated events as a clickable list. Selecting an item (again) calls `onSelect`;
 * the chart zooms to it and back.
 */
export function renderEvents(
  list: HTMLElement,
  items: readonly MarketEvent[],
  selected: MarketEvent | null,
  onSelect: (event: MarketEvent) => void,
): void {
  if (items.length === 0) {
    list.replaceChildren(h('li', { class: 'empty' }, 'Keine Ereignisse'));
    return;
  }
  list.replaceChildren(
    ...items.map((e) => {
      const direction = e.direction ? DIRECTION_LABEL[e.direction] : null;
      const meta = [formatDate(e.event_date), CATEGORY_LABEL[e.category], direction].filter(Boolean).join(' · ');
      const button = h(
        'button',
        { type: 'button', class: 'event-button' },
        e.title,
        h('span', { class: 'event-meta' }, meta),
      );
      button.addEventListener('click', () => onSelect(e));
      const classes = `event-item ${e.direction ?? 'neutral'}${isEventSelected(e, selected) ? ' is-selected' : ''}`;
      return h('li', { class: classes }, button);
    }),
  );
}
