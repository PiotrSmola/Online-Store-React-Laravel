// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quoteCart } from '../lib/quote';
import { useCartQuote } from './useCartQuote';

vi.mock('../lib/quote', () => ({ quoteCart: vi.fn() }));

const DEBOUNCE = 250;
const one = [{ product_id: 1, size: null, color: null, quantity: 1 }];
const two = [{ product_id: 1, size: null, color: null, quantity: 2 }];

const render = (items) => renderHook((props) => useCartQuote(props.items), { initialProps: { items } });

const settle = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  quoteCart.mockImplementation(async (items) => ({ total: items[0].quantity }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useCartQuote', () => {
  it('reports loading from the moment the cart changes, before the request starts', async () => {
    const { result, rerender } = render(one);
    await settle();
    expect(result.current).toMatchObject({ loading: false, data: { total: 1 } });

    rerender({ items: two });

    expect(quoteCart).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({ loading: true, data: { total: 1 } });
  });

  it('settles on the new quote after the delay', async () => {
    const { result, rerender } = render(one);
    await settle();

    rerender({ items: two });
    await settle(DEBOUNCE);
    await settle();

    expect(result.current).toMatchObject({ loading: false, data: { total: 2 } });
  });

  it('is not loading for an empty cart', async () => {
    const { result, rerender } = render(one);
    await settle();

    rerender({ items: [] });

    expect(result.current.loading).toBe(false);
  });

  it('gives the same object until something changes', async () => {
    const { result, rerender } = render(one);
    await settle();

    const first = result.current;
    rerender({ items: one });

    expect(result.current).toBe(first);
  });
});
