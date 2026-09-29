import type { NewsDirection, NewsItem } from '../data/types';
import { formatDate } from '../lib/format';
import { h } from './dom';

const DIRECTION_LABEL: Record<NewsDirection, string> = {
  bullish: 'preistreibend',
  bearish: 'preissenkend',
  neutral: 'neutral',
};

/** Only http(s) links are rendered as links. */
function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export function renderNews(list: HTMLElement, items: readonly NewsItem[]): void {
  if (items.length === 0) {
    list.replaceChildren(h('li', { class: 'empty' }, 'Noch keine Meldungen'));
    return;
  }
  list.replaceChildren(
    ...items.map((n) => {
      const href = safeUrl(n.url);
      const title = href
        ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, n.title)
        : h('span', {}, n.title);
      const direction = n.direction ? DIRECTION_LABEL[n.direction] : null;
      const meta = [n.source, formatDate(n.published_at), direction].filter(Boolean).join(' · ');
      return h('li', { class: `news-item ${n.direction ?? 'neutral'}` }, title, h('div', { class: 'news-meta' }, meta));
    }),
  );
}
