import { formatDate } from '../lib/format';

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} fehlt`);
  return el as T;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}

/** Status line of a section: loading hint, error or nothing. */
export class SectionStatus {
  private readonly el: HTMLElement;

  constructor(section: HTMLElement) {
    const el = section.querySelector<HTMLElement>('[data-status]');
    if (!el) throw new Error(`Statuszeile in #${section.id} fehlt`);
    this.el = el;
  }

  loading(text = 'Lädt …'): void {
    this.el.classList.remove('is-error');
    this.el.removeAttribute('role');
    this.el.textContent = text;
  }

  clear(): void {
    this.el.classList.remove('is-error');
    this.el.removeAttribute('role');
    this.el.textContent = '';
  }

  /** Shows a failure; if older data is still displayed, says how old it is. */
  error(what: string, err: unknown, shownAsOf: string | null = null): void {
    const reason = err instanceof Error ? err.message : String(err);
    const keep = shownAsOf ? ` Angezeigt wird weiter der Stand vom ${formatDate(shownAsOf)}.` : '';
    this.el.classList.add('is-error');
    this.el.setAttribute('role', 'alert');
    this.el.textContent = `${what} konnte nicht geladen werden (${reason}).${keep}`;
  }
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Fills a radiogroup container with toggle buttons; returns a setter for the checked value. */
export function segmented<T extends string>(
  container: HTMLElement,
  options: readonly SegmentOption<T>[],
  initial: T,
  onChange: (value: T) => void,
): (value: T) => void {
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', role: 'radio', 'data-value': o.value }, o.label);
    b.addEventListener('click', () => {
      set(o.value);
      onChange(o.value);
    });
    return b;
  });
  function set(value: T): void {
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.value === value));
  }
  container.replaceChildren(...buttons);
  set(initial);
  return set;
}
