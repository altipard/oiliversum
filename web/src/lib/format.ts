export const DASH = '–';

const eurLiter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const usd = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const share = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** EUR per 1000 l -> EUR per litre. */
export function perLiter(eur1000l: number | null | undefined): number | null {
  return eur1000l == null || !Number.isFinite(eur1000l) ? null : eur1000l / 1000;
}

/** Formats a EUR-per-litre value with 3 decimals, e.g. "1,925 €/l". */
export function formatEurLiter(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? DASH : `${eurLiter.format(value)} €/l`;
}

export function formatUsdBbl(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? DASH : `${usd.format(value)} $/bbl`;
}

/** Formats a relative change (0.06 = 6 %) with sign. */
export function formatChange(ratio: number | null | undefined): string {
  return ratio == null || !Number.isFinite(ratio) ? DASH : `${pct.format(ratio * 100)} %`;
}

/** Formats a fraction (0.35 = 35 %) without sign. */
export function formatShare(ratio: number | null | undefined): string {
  return ratio == null || !Number.isFinite(ratio) ? DASH : `${share.format(ratio * 100)} %`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** For text placed into ECharts tooltip HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

/** "2026-09-21" -> "21.09.2026". Timestamps are shown with their date part. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : DASH;
}
