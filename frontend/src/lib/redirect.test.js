import { describe, expect, it } from 'vitest';
import { loginPath, safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it.each(['/', '/orders', '/orders/5', '/category/Obuwie?x=1', '/checkout#payment'])('follows %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.test',
    '//evil.test',
    '///evil.test',
    '/\\evil.test',
    '\\\\evil.test',
    'javascript:alert(1)',
    'orders',
    '/ /evil.test',
    '/\t/evil.test',
    '',
    null,
    undefined,
  ])('falls back for %j', (target) => {
    expect(safeRedirect(target)).toBe('/');
  });

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil.test', '/orders')).toBe('/orders');
  });
});

describe('loginPath', () => {
  it('escapes the target so its query stays in the parameter', () => {
    expect(loginPath('/orders?a=1')).toBe('/login?next=%2Forders%3Fa%3D1');
  });
});
