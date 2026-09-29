import { formatChange, formatEurLiter, formatShare, perLiter, DASH } from '../lib/format';
import type { CountryRow, SortDir, SortKey, TaxMode } from '../lib/table';
import { MAX_SELECTED } from '../lib/timeline';
import { h } from './dom';

interface Column {
  key: SortKey;
  label: string;
  cell: (r: CountryRow) => string;
  cls?: (r: CountryRow) => string;
}

function columns(tax: TaxMode): Column[] {
  return [
    { key: 'name', label: 'Land', cell: (r) => r.name },
    {
      key: 'price',
      label: tax === 'with' ? 'Preis' : 'Preis o. St.',
      cell: (r) => formatEurLiter(perLiter(r.price)),
    },
    {
      key: 'change',
      label: 'zur Vorwoche',
      cell: (r) => formatChange(r.change),
      cls: (r) => (r.change == null || r.change === 0 ? '' : r.change > 0 ? 'up' : 'down'),
    },
    { key: 'taxShare', label: 'Steueranteil', cell: (r) => formatShare(r.taxShare) },
    { key: 'crudeShare', label: 'Rohölanteil', cell: (r) => formatShare(r.crudeShare) },
    {
      key: 'lagWeeks',
      label: 'Verzögerung',
      cell: (r) => (r.lagWeeks == null ? DASH : `${r.lagWeeks} Wo.`),
    },
  ];
}

export interface TableHandlers {
  onSort: (key: SortKey) => void;
  onSelect: (code: string) => void;
}

export function renderTable(
  table: HTMLTableElement,
  rows: readonly CountryRow[],
  sort: { key: SortKey; dir: SortDir },
  tax: TaxMode,
  selected: readonly string[],
  handlers: TableHandlers,
): void {
  const cols = columns(tax);
  const head = h(
    'tr',
    {},
    ...cols.map((c) => {
      const btn = h('button', { type: 'button' }, c.label);
      btn.addEventListener('click', () => handlers.onSort(c.key));
      const th = h('th', { scope: 'col' }, btn);
      th.setAttribute('aria-sort', c.key === sort.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      return th;
    }),
  );
  const full = selected.length >= MAX_SELECTED;
  const body = rows.map((r) => {
    const isSelected = selected.includes(r.code);
    const [first, ...rest] = cols;
    const nameBtn = h('button', { type: 'button' }, first!.cell(r));
    nameBtn.title = isSelected
      ? 'Bereits in der Zeitreihe'
      : full
        ? `Höchstens ${MAX_SELECTED} Länder, erst eines entfernen`
        : 'Zur Zeitreihe hinzufügen';
    nameBtn.disabled = !isSelected && full;
    nameBtn.addEventListener('click', () => handlers.onSelect(r.code));
    return h(
      'tr',
      { class: isSelected ? 'is-selected' : '' },
      h('th', { scope: 'row' }, nameBtn),
      ...rest.map((c) => h('td', { class: c.cls?.(r) ?? '' }, c.cell(r))),
    );
  });
  table.replaceChildren(h('thead', {}, head), h('tbody', {}, ...body));
}
