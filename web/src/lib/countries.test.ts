import { describe, expect, it } from 'vitest';
import { alpha2FromNumeric, countryNameDe } from './countries';

describe('alpha2FromNumeric', () => {
  it('maps zero-padded and numeric world-atlas ids', () => {
    expect(alpha2FromNumeric('276')).toBe('DE');
    expect(alpha2FromNumeric('040')).toBe('AT');
    expect(alpha2FromNumeric(40)).toBe('AT');
    expect(alpha2FromNumeric('616')).toBe('PL');
  });

  it('maps Greece to GR, not EL', () => {
    expect(alpha2FromNumeric('300')).toBe('GR');
  });

  it('covers all EU member states of the bulletin', () => {
    const eu = [40, 56, 100, 191, 196, 203, 208, 233, 246, 250, 276, 300, 348, 372, 380, 428, 440, 442, 470, 528, 616, 620, 642, 703, 705, 724, 752];
    const codes = eu.map((n) => alpha2FromNumeric(n));
    expect(codes).not.toContain(null);
    expect(new Set(codes).size).toBe(27);
  });

  it('returns null for unknown or missing ids', () => {
    expect(alpha2FromNumeric('840')).toBeNull();
    expect(alpha2FromNumeric(undefined)).toBeNull();
    expect(alpha2FromNumeric('')).toBeNull();
  });
});

describe('countryNameDe', () => {
  it('returns German names and falls back to the code', () => {
    expect(countryNameDe('DE')).toBe('Deutschland');
    expect(countryNameDe('GR')).toBe('Griechenland');
    expect(countryNameDe('EU')).toBe('EU-Durchschnitt');
    expect(countryNameDe('XX')).toBe('XX');
  });
});
