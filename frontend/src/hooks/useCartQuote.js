import { useCallback } from 'react';
import { quoteCart } from '../lib/quote';
import { useResource } from './useResource';

/** The priced cart. The last quote stays on screen while a new one loads, so totals do not flash. */
export function useCartQuote(items, { deliveryMethod = null } = {}) {
  const load = useCallback(
    (signal) => quoteCart(items, { deliveryMethod, signal }),
    [items, deliveryMethod],
  );
  const key = items.length > 0 ? JSON.stringify([items, deliveryMethod]) : null;

  return useResource(load, key, { keepPrevious: true });
}
