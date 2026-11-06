import { request } from './api';

function toOrderItem(item) {
  const unitPrice = Number.parseFloat(item.price);
  return { ...item, unitPrice, lineTotal: unitPrice * item.quantity };
}

/** Totals as numbers, because the API sends decimals as strings. New order fields belong here. */
export function toOrder(order) {
  const total = Number.parseFloat(order.total_amount);
  const deliveryPrice = Number.parseFloat(order.delivery_price ?? 0);

  return {
    ...order,
    total,
    deliveryPrice,
    itemsTotal: total - deliveryPrice,
    items: (order.items ?? []).map(toOrderItem),
  };
}

export async function getOrders({ signal } = {}) {
  return (await request('/orders', { signal })).map(toOrder);
}

export async function getOrder(id, { signal } = {}) {
  return toOrder(await request(`/orders/${encodeURIComponent(id)}`, { signal }));
}

/** Resolves to { order, customer, message, token? }. */
export async function placeOrder(payload) {
  const result = await request('/orders', { method: 'POST', body: payload });
  return { ...result, order: toOrder(result.order) };
}
