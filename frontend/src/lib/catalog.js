import { request } from './api';

// A later catalog API answers with one page of products. Pages read { items, total } only, so
// pagination and filters change this file alone.
function toProductPage(data, limit) {
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return {
    items: limit ? items.slice(0, limit) : items,
    total: Array.isArray(data) ? data.length : (data?.total ?? items.length),
  };
}

export async function getProducts({ limit, signal } = {}) {
  return toProductPage(await request('/products', { signal }), limit);
}

export async function getProductsByCategory(category, { limit, signal } = {}) {
  const path = `/products/category/${encodeURIComponent(category)}`;
  return toProductPage(await request(path, { signal }), limit);
}

export function getProduct(id, { signal } = {}) {
  return request(`/products/${encodeURIComponent(id)}`, { signal });
}

export function getCategories({ signal } = {}) {
  return request('/categories', { signal });
}
