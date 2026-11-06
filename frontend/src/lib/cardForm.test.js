import { describe, expect, it } from 'vitest';
import { cardLastFour, formatCardNumber, formatExpiry, validateCard } from './cardForm';

const now = new Date(2026, 10, 6);
const card = { number: '4242 4242 4242 4242', name: 'Jan Kowalski', expiry: '12/28', cvv: '123' };

describe('card input formatting', () => {
  it('groups the number in fours and drops other characters', () => {
    expect(formatCardNumber('4111-1111x1111 1111')).toBe('4111 1111 1111 1111');
  });

  it('allows 19 digits at most', () => {
    expect(formatCardNumber('1'.repeat(25)).replace(/\s/g, '')).toHaveLength(19);
  });

  it('adds the slash to the expiry date', () => {
    expect(formatExpiry('12')).toBe('12');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('12/289')).toBe('12/28');
  });
});

describe('validateCard', () => {
  it('accepts a valid card', () => {
    expect(validateCard(card, now)).toEqual({});
  });

  it('accepts the declining test card, which the server refuses', () => {
    expect(validateCard({ ...card, number: '4000 0000 0000 0002' }, now)).toEqual({});
  });

  it.each(['4242 4242 4242 4241', '4242', ''])('rejects the number "%s"', (number) => {
    expect(validateCard({ ...card, number }, now).number).toBeTruthy();
  });

  it('needs the name on the card', () => {
    expect(validateCard({ ...card, name: '  ' }, now).name).toBeTruthy();
  });

  it.each(['13/28', '00/28', '1/28', '10/26', '12/25', ''])('rejects the expiry date "%s"', (expiry) => {
    expect(validateCard({ ...card, expiry }, now).expiry).toBeTruthy();
  });

  it('accepts a card expiring this month', () => {
    expect(validateCard({ ...card, expiry: '11/26' }, now)).toEqual({});
  });

  it.each(['12', '12345', 'abc', ''])('rejects the CVV "%s"', (cvv) => {
    expect(validateCard({ ...card, cvv }, now).cvv).toBeTruthy();
  });
});

describe('cardLastFour', () => {
  it('keeps only the last four digits', () => {
    expect(cardLastFour('4000 0000 0000 0002')).toBe('0002');
  });
});
