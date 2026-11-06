import { useCallback, useMemo } from 'react';
import { quoteCart } from '../lib/quote';
import { useDebouncedValue } from './useDebouncedValue';
import { useResource } from './useResource';

const DEBOUNCE_MS = 250;

/**
 * The priced cart from the server. Quick changes send one request, and the last quote stays on
 * screen while a new one loads, so totals do not flash. loading is also true during the debounce,
 * when data already describes an older cart.
 */
export function useCartQuote(items, { coupon = '', deliveryMethod = null } = {}) {
  const latest = JSON.stringify({ items, coupon, deliveryMethod });
  const request = useDebouncedValue(latest, DEBOUNCE_MS);
  const hasItems = items.length > 0;

  const load = useCallback((signal) => {
    const { items: quoted, ...options } = JSON.parse(request);
    return quoteCart(quoted, { ...options, signal });
  }, [request]);

  const resource = useResource(load, hasItems ? request : null, { keepPrevious: true });
  const waiting = hasItems && latest !== request;

  return useMemo(() => (waiting ? { ...resource, loading: true } : resource), [resource, waiting]);
}
