import { request } from './api';
import { cartFromQuote } from './cart';
import { toQuoteItems } from './quote';

/** The cart saved on the account, as local cart lines. */
export async function getSavedCart({ signal } = {}) {
  return cartFromQuote(await request('/cart', { signal }));
}

/** keepalive lets the last change reach the server while the page is closing. */
export function saveCart(items, { signal, keepalive } = {}) {
  return request('/cart', { method: 'PUT', body: { items: toQuoteItems(items) }, signal, keepalive });
}
