import { request } from './api';

function toQuoteItem({ product_id: productId, quantity, size, color }) {
  return { product_id: productId, quantity, size: size ?? undefined, color: color ?? undefined };
}

/** The items as the cart endpoints take them. Orders use other names: see buildOrderPayload. */
export function toQuoteItems(items) {
  return items.map(toQuoteItem);
}

/** The server prices the cart: see "Quote" in backend/docs/api.md for the result. */
export function quoteCart(items, { coupon, deliveryMethod, signal } = {}) {
  return request('/cart/quote', {
    method: 'POST',
    signal,
    body: {
      items: toQuoteItems(items),
      coupon: coupon || undefined,
      delivery_method: deliveryMethod || undefined,
    },
  });
}
