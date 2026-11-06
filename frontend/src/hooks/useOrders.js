import { useCallback } from 'react';
import { getOrder, getOrders } from '../lib/orders';
import { useResource } from './useResource';

export function useOrders() {
  const load = useCallback((signal) => getOrders({ signal }), []);
  return useResource(load, 'orders');
}

export function useOrder(id) {
  const load = useCallback((signal) => getOrder(id, { signal }), [id]);
  return useResource(load, `order:${id}`);
}
