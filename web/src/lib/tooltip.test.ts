import { describe, expect, it } from 'vitest';
import type { BreakdownRow, MarketEvent, NewsItem } from '../data/types';
import { mapNoDataHtml, mapTooltipHtml, seriesTooltipHtml } from './tooltip';

const XSS = '<img src=x onerror=alert(1)>';

function row(country_code: string): BreakdownRow {
  return {
    week_date: '2026-09-21',
    country_code,
    fuel_type: 'euro95',
    eur_1000l_with_tax: 2000,
    eur_1000l_without_tax: 1000,
    tax_eur_1000l: 1000,
    crude_eur_1000l: 600,
    margin_eur_1000l: 400,
    crude_share: 0.3,
  };
}

function news(title: string): NewsItem {
  return { title, url: 'https://example.org', published_at: '2026-09-20', relevance: 0.9, direction: 'bearish', source: 's' };
}

function event(title: string): MarketEvent {
  return {
    event_date: '2026-09-21',
    title,
    category: 'geopolitik',
    direction: 'bullish',
    severity: 3,
    description: null,
    source_url: null,
    tags: [],
  };
}

describe('mapTooltipHtml', () => {
  it('shows name, price and breakdown', () => {
    const html = mapTooltipHtml(row('DE'), 2, 'with');
    expect(html).toContain('<strong>Deutschland</strong>');
    expect(html).toContain('Preis inkl. Steuern: <strong>2,000 €/l</strong>');
    expect(html).toContain('Rohöl (Brent): 0,600 €/l (30 %)');
    expect(html).toContain('Steuern und Abgaben: 1,000 €/l (50 %)');
  });

  it('escapes an unknown country code coming from data', () => {
    const html = mapTooltipHtml(row(XSS), 2, 'without');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mapNoDataHtml(XSS)).not.toContain('<img');
  });
});

describe('seriesTooltipHtml', () => {
  it('escapes series names and news headlines, keeps the ECharts marker', () => {
    const marker = '<span style="background-color:#123;"></span>';
    const html = seriesTooltipHtml(
      '2026-09-21',
      [{ marker, name: 'Polen "PL"', value: 1.5 }],
      [news(XSS), news('Brent & WTI "fallen"')],
    );
    expect(html).toContain(`${marker}Polen &quot;PL&quot;: <strong>1,500 €/l</strong>`);
    expect(html).toContain('• &lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('• Brent &amp; WTI &quot;fallen&quot;');
    expect(html).not.toContain('<img');
    expect(html.startsWith('<strong>Woche 21.09.2026</strong>')).toBe(true);
  });

  it('lists events with their category, escaped', () => {
    const html = seriesTooltipHtml('2026-09-21', [], [], [event(XSS), event('Straße von Hormus gesperrt')]);
    expect(html).toContain('◆ &lt;img src=x onerror=alert(1)&gt; (Geopolitik)');
    expect(html).toContain('◆ Straße von Hormus gesperrt (Geopolitik)');
    expect(html).not.toContain('<img');
  });
});
