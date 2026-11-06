import { useCallback } from 'react';
import { getCategories, getProduct, getProducts, getProductsByCategory } from '../lib/catalog';
import { useResource } from './useResource';

export function useProducts({ limit } = {}) {
  const load = useCallback((signal) => getProducts({ limit, signal }), [limit]);
  return useResource(load, `products:${limit ?? 'all'}`);
}

export function useCategoryProducts(category, { limit } = {}) {
  const load = useCallback((signal) => getProductsByCategory(category, { limit, signal }), [category, limit]);
  return useResource(load, category ? `category:${category}:${limit ?? 'all'}` : null);
}

export function useProduct(id) {
  const load = useCallback((signal) => getProduct(id, { signal }), [id]);
  return useResource(load, `product:${id}`);
}

export function useCategories() {
  const load = useCallback((signal) => getCategories({ signal }), []);
  return useResource(load, 'categories');
}
