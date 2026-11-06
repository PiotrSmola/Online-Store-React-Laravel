// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

const render = () => renderHook(({ value }) => useDebouncedValue(value, 100), { initialProps: { value: 'a' } });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('starts with the value, so a first request waits for nothing', () => {
    expect(render().result.current).toBe('a');
  });

  it('holds a new value back until the delay has passed', () => {
    const { result, rerender } = render();

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('b');
  });

  it('skips the values in between', () => {
    const { result, rerender } = render();

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(60));
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(40));
    expect(result.current).toBe('c');
  });

  it('clears its timer on unmount', () => {
    const { rerender, unmount } = render();

    rerender({ value: 'b' });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
