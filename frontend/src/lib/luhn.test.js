import { describe, expect, it } from 'vitest';
import { passesLuhn } from './luhn';

describe('passesLuhn', () => {
  it.each(['4111111111111111', '5555555555554444', '378282246310005', '4000000000000002'])(
    'accepts the valid number %s',
    (number) => {
      expect(passesLuhn(number)).toBe(true);
    },
  );

  it('ignores spaces', () => {
    expect(passesLuhn('4111 1111 1111 1111')).toBe(true);
  });

  it('rejects a changed digit', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);
  });

  it('rejects two swapped neighbouring digits', () => {
    expect(passesLuhn('5555555555545444')).toBe(false);
  });

  it.each(['', '   ', '4111-1111-1111-1111', 'abcd', null, undefined])('rejects %j', (value) => {
    expect(passesLuhn(value)).toBe(false);
  });
});
