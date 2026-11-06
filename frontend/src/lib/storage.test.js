import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from './storage';

function workingStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

function blockLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied', 'SecurityError');
    },
  });
}

afterEach(() => {
  safeStorage.removeItem('key');
  delete globalThis.localStorage;
  vi.unstubAllGlobals();
});

describe('safeStorage', () => {
  it('uses localStorage when it works', () => {
    const storage = workingStorage();
    vi.stubGlobal('localStorage', storage);

    safeStorage.setItem('key', 'value');

    expect(storage.getItem('key')).toBe('value');
    expect(safeStorage.getItem('key')).toBe('value');
  });

  it('returns null for a missing key', () => {
    vi.stubGlobal('localStorage', workingStorage());
    expect(safeStorage.getItem('key')).toBeNull();
  });

  it('does not throw when reading the global itself raises SecurityError', () => {
    blockLocalStorage();

    expect(safeStorage.getItem('key')).toBeNull();
    expect(() => safeStorage.setItem('key', 'value')).not.toThrow();
    expect(() => safeStorage.removeItem('key')).not.toThrow();
  });

  it('keeps values in memory while storage is blocked', () => {
    blockLocalStorage();

    safeStorage.setItem('key', 'value');
    expect(safeStorage.getItem('key')).toBe('value');

    safeStorage.removeItem('key');
    expect(safeStorage.getItem('key')).toBeNull();
  });

  it('keeps a value in memory when storage is full', () => {
    vi.stubGlobal('localStorage', {
      ...workingStorage(),
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError');
      },
    });

    safeStorage.setItem('key', 'value');
    expect(safeStorage.getItem('key')).toBe('value');
  });
});
