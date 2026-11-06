import { describe, expect, it } from 'vitest';
import { countProducts, formatDate, formatDateTime, formatPrice, formatRating, pluralize } from './format';

// Intl separates the amount from the currency with a no-break space.
const plainSpaces = (text) => text.replace(/\s/g, ' ');

describe('formatPrice', () => {
  it('formats numbers and API decimal strings the same way', () => {
    expect(plainSpaces(formatPrice(549.99))).toBe('549,99 zł');
    expect(plainSpaces(formatPrice('549.99'))).toBe('549,99 zł');
  });

  it('always shows two decimals', () => {
    expect(plainSpaces(formatPrice(15))).toBe('15,00 zł');
    expect(plainSpaces(formatPrice('0.00'))).toBe('0,00 zł');
  });

  it('groups five digit amounts', () => {
    expect(plainSpaces(formatPrice(12345.6))).toBe('12 345,60 zł');
  });

  it('returns an empty string for anything that is not an amount', () => {
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
    expect(formatPrice('abc')).toBe('');
  });
});

describe('formatRating', () => {
  it('uses a decimal comma', () => {
    expect(formatRating('4.8')).toBe('4,8');
    expect(formatRating(4)).toBe('4,0');
  });
});

describe('formatDate', () => {
  it('writes the month as a word in Polish', () => {
    expect(formatDate('2026-11-06T12:00:00')).toBe('6 listopada 2026');
  });

  it('accepts Date objects', () => {
    expect(formatDate(new Date(2026, 0, 15, 12))).toBe('15 stycznia 2026');
  });

  it('adds the time when asked', () => {
    expect(formatDateTime('2026-11-06T08:05:00')).toContain('08:05');
  });

  it('returns an empty string for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});

describe('pluralize', () => {
  const forms = ['produkt', 'produkty', 'produktów'];

  it.each([
    [0, 'produktów'],
    [1, 'produkt'],
    [2, 'produkty'],
    [4, 'produkty'],
    [5, 'produktów'],
    [11, 'produktów'],
    [12, 'produktów'],
    [14, 'produktów'],
    [21, 'produktów'],
    [22, 'produkty'],
    [104, 'produkty'],
    [112, 'produktów'],
  ])('picks the form for %i', (count, expected) => {
    expect(pluralize(count, ...forms)).toBe(expected);
  });

  it('writes the count with its noun', () => {
    expect(countProducts(3)).toBe('3 produkty');
  });
});
