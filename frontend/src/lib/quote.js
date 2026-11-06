import { request } from './api';
import { STORE_PICKUP } from './checkoutForm';
import { formatPrice } from './format';

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

/** The line about free delivery. Empty without a quote, and when nothing is being delivered. */
export function freeDeliveryText(quote, deliveryMethod = null) {
  if (!quote || deliveryMethod === STORE_PICKUP) return '';

  return quote.free_delivery_missing > 0
    ? `Do bezpłatnej dostawy brakuje ${formatPrice(quote.free_delivery_missing)}.`
    : 'Masz bezpłatną dostawę.';
}
