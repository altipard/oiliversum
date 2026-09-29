import type { BrentHeadline } from '../lib/brent';
import { formatChange, formatDate, formatEurLiter, formatUsdBbl } from '../lib/format';
import { h } from './dom';

function changeEl(label: string, ratio: number | null): HTMLElement {
  const cls = ratio == null || ratio === 0 ? '' : ratio > 0 ? 'up' : 'down';
  return h(
    'div',
    { class: 'kpi' },
    h('span', { class: 'kpi-label' }, label),
    h('span', { class: `kpi-sub ${cls}` }, formatChange(ratio)),
  );
}

export function renderHeadline(body: HTMLElement, brent: BrentHeadline | null, bulletinDate: string | null): void {
  const asOf = h(
    'p',
    { class: 'asof' },
    `Datenstand Brent: ${formatDate(brent?.date)}`,
    brent?.fxDate && brent.fxDate !== brent.date ? ` (EUR/USD vom ${formatDate(brent.fxDate)})` : '',
    ` · Weekly Oil Bulletin: ${formatDate(bulletinDate)}`,
  );
  if (!brent) {
    body.replaceChildren(h('p', { class: 'empty' }, 'Keine Brent-Notierung vorhanden.'), asOf);
    return;
  }
  body.replaceChildren(
    h(
      'div',
      { class: 'kpi' },
      h('span', { class: 'kpi-label' }, 'Brent'),
      h('span', { class: 'kpi-value' }, formatUsdBbl(brent.usdBbl)),
    ),
    h(
      'div',
      { class: 'kpi' },
      h('span', { class: 'kpi-label' }, 'Brent je Liter'),
      h('span', { class: 'kpi-value' }, formatEurLiter(brent.eurLiter)),
    ),
    changeEl('zum Vortag', brent.changeDay),
    changeEl('zur Vorwoche', brent.changeWeek),
    asOf,
  );
}
