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

  it.each([
    '/.//evil.test',
    '/..//evil.test',
    '/a/..//evil.test',
    '/%2e%2e//evil.test',
    '/%2E//evil.test',
    '/.//.//evil.test',
    '/a/b/../..//evil.test',
    '/.//evil.test/path?x=1#y',
  ])('falls back when normalising %s leaves a second leading slash', (target) => {
    expect(safeRedirect(target)).toBe('/');
  });

  it('keeps the query and hash of an internal path', () => {
    expect(safeRedirect('/orders/5?tab=items#details')).toBe('/orders/5?tab=items#details');
  });

  it('follows a normalised internal path', () => {
    expect(safeRedirect('/a/../orders')).toBe('/orders');
  });

  it('keeps an encoded slash or backslash inside the site', () => {
    expect(safeRedirect('/%2F/evil.test')).toBe('/%2F/evil.test');
    expect(safeRedirect('/%5Cevil.test')).toBe('/%5Cevil.test');
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
