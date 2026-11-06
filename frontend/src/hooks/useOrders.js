import { useCallback } from 'react';
import { getOrder, getOrders } from '../lib/orders';
import { useResource } from './useResource';

export function useOrders(page) {
  const load = useCallback((signal) => getOrders(page, { signal }), [page]);
  return useResource(load, `orders:${page}`);
}

export function useOrder(id) {
  const load = useCallback((signal) => getOrder(id, { signal }), [id]);
  return useResource(load, `order:${id}`);
}
