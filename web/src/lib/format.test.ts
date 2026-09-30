import { describe, expect, it } from 'vitest';
import { escapeHtml, formatChange, formatDate, formatEurLiter, formatShare, formatUsdBbl, perLiter } from './format';

describe('perLiter', () => {
  it('converts EUR per 1000 l to EUR per litre', () => {
    expect(perLiter(1925)).toBeCloseTo(1.925);
  });

  it('keeps missing values missing', () => {
    expect(perLiter(null)).toBeNull();
    expect(perLiter(undefined)).toBeNull();
    expect(perLiter(Number.NaN)).toBeNull();
  });
});

describe('formatters', () => {
  it('shows EUR per litre with 3 decimals', () => {
    expect(formatEurLiter(1.925)).toBe('1,925 €/l');
    expect(formatEurLiter(0.6)).toBe('0,600 €/l');
  });

  it('shows USD per barrel with 2 decimals', () => {
    expect(formatUsdBbl(114.89)).toBe('114,89 $/bbl');
  });

  it('shows changes with sign and shares without', () => {
    expect(formatChange(-0.06)).toMatch(/^[-−]6,0 %$/);
    expect(formatChange(0.012)).toBe('+1,2 %');
    expect(formatChange(0)).toBe('0,0 %');
    expect(formatShare(0.3523)).toBe('35 %');
  });

  it('uses a dash for missing values', () => {
    expect(formatEurLiter(null)).toBe('–');
    expect(formatChange(null)).toBe('–');
    expect(formatShare(undefined)).toBe('–');
    expect(formatDate(null)).toBe('–');
  });

  it('formats dates and timestamps as German dates', () => {
    expect(formatDate('2026-09-21')).toBe('21.09.2026');
    expect(formatDate('2026-09-29T14:59:33.511141+00:00')).toBe('29.09.2026');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<b>"OPEC" & \'Co\'</b>')).toBe('&lt;b&gt;&quot;OPEC&quot; &amp; &#39;Co&#39;&lt;/b&gt;');
  });

  it('neutralises an injected image tag in a headline', () => {
    const out = escapeHtml('<img src=x onerror=alert(1)> Ölpreis "fällt"');
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt; Ölpreis &quot;fällt&quot;');
    expect(out).not.toMatch(/[<>"]/);
  });

  it('escapes the ampersand first so entities are not double-interpreted', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });
});
