import { useCallback } from 'react';
import { getCatalogFilters, getCategories, getProduct, getProducts, getShopConfig } from '../lib/catalog';
import { useResource } from './useResource';

/** query holds the fields of GET /products. Old results stay on screen while new ones load. */
export function useProducts(query) {
  const key = `products:${JSON.stringify(query)}`;
  const load = useCallback((signal) => getProducts(JSON.parse(key.slice('products:'.length)), { signal }), [key]);
  return useResource(load, key, { keepPrevious: true });
}

export function useCatalogFilters(category) {
  const load = useCallback((signal) => getCatalogFilters({ category, signal }), [category]);
  return useResource(load, `filters:${category ?? ''}`);
}

export function useProduct(id) {
  const load = useCallback((signal) => getProduct(id, { signal }), [id]);
  return useResource(load, `product:${id}`);
}

export function useCategories() {
  const load = useCallback((signal) => getCategories({ signal }), []);
  return useResource(load, 'categories');
}

export function useShopConfig() {
  const load = useCallback((signal) => getShopConfig({ signal }), []);
  return useResource(load, 'config');
}
