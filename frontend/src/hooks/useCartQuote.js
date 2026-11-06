import { useCallback } from 'react';
import { quoteCart } from '../lib/quote';
import { useDebouncedValue } from './useDebouncedValue';
import { useResource } from './useResource';

const DEBOUNCE_MS = 250;

/**
 * The priced cart from the server. Quick changes send one request, and the last quote stays on
 * screen while a new one loads, so totals do not flash.
 */
export function useCartQuote(items, { coupon = '', deliveryMethod = null } = {}) {
  const request = useDebouncedValue(JSON.stringify({ items, coupon, deliveryMethod }), DEBOUNCE_MS);

  const load = useCallback((signal) => {
    const { items: quoted, ...options } = JSON.parse(request);
    return quoteCart(quoted, { ...options, signal });
  }, [request]);

  return useResource(load, items.length > 0 ? request : null, { keepPrevious: true });
}
