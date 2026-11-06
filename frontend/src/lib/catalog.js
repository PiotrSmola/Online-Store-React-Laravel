import { request } from './api';

export function toSearch(query) {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : '';
}

/** The fields of Laravel's paginator that pages use. */
export function toPage(data) {
  return {
    items: data.data,
    total: data.total,
    page: data.current_page,
    lastPage: data.last_page,
  };
}

/** Query fields are those of GET /products: q, category, sort, page and so on. */
export async function getProducts(query = {}, { signal } = {}) {
  return toPage(await request(`/products${toSearch(query)}`, { signal }));
}

export function getProduct(id, { signal } = {}) {
  return request(`/products/${encodeURIComponent(id)}`, { signal });
}

export function getCatalogFilters({ category, signal } = {}) {
  return request(`/catalog/filters${toSearch({ category })}`, { signal });
}

export function getCategories({ signal } = {}) {
  return request('/categories', { signal });
}

export function getShopConfig({ signal } = {}) {
  return request('/config', { signal });
}

export function postReview(productId, review) {
  return request(`/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: review });
}
