import { request } from './api';
import { toPage } from './catalog';

export async function getWishlist(page = 1, { signal } = {}) {
  return toPage(await request(`/wishlist?page=${page}`, { signal }));
}

/** The API has no "is this product saved" call, so this reads the list, 48 products per page. */
export async function getWishlistIds({ signal } = {}) {
  const ids = new Set();
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage) {
    const result = await getWishlist(page, { signal });
    result.items.forEach((product) => ids.add(product.id));
    lastPage = result.lastPage;
    page += 1;
  }

  return ids;
}

export function addToWishlist(productId) {
  return request(`/wishlist/${encodeURIComponent(productId)}`, { method: 'POST' });
}

export function removeFromWishlist(productId) {
  return request(`/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}
