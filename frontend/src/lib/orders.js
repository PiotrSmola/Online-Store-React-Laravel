import { download, request } from './api';
import { toPage } from './catalog';

function toOrderItem(item) {
  const unitPrice = Number.parseFloat(item.price);

  return {
    ...item,
    unitPrice,
    lineTotal: unitPrice * item.quantity,
    name: item.product_name ?? item.product?.nazwa ?? 'Produkt',
  };
}

function amount(value) {
  return Number.parseFloat(value ?? 0);
}

/** Totals as numbers, because stored amounts arrive as strings. */
export function toOrder(order) {
  return {
    ...order,
    subtotal: amount(order.subtotal_amount),
    discount: amount(order.discount_amount),
    deliveryPrice: amount(order.delivery_price),
    total: amount(order.total_amount),
    items: (order.items ?? []).map(toOrderItem),
    statusEvents: order.status_events ?? [],
  };
}

export function canPayOrder(order) {
  return order.payment_method === 'card' && order.status === 'pending' && order.payment_status !== 'paid';
}

export function canCancelOrder(order) {
  return order.status === 'pending';
}

export function hasInvoice(order) {
  return Boolean(order.invoice_number) || order.payment_status === 'paid';
}

export async function getOrders(page = 1, { signal } = {}) {
  const result = toPage(await request(`/orders?page=${page}`, { signal }));
  return { ...result, items: result.items.map(toOrder) };
}

export async function getOrder(id, { signal } = {}) {
  return toOrder(await request(`/orders/${encodeURIComponent(id)}`, { signal }));
}

/** Resolves to { order, customer, message, token? }. */
export async function placeOrder(payload) {
  const result = await request('/orders', { method: 'POST', body: payload });
  return { ...result, order: toOrder(result.order) };
}

export async function cancelOrder(id) {
  return toOrder(await request(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' }));
}

/** Only the last four digits ever leave the card form. */
export async function payOrder(id, cardLastFour) {
  const order = await request(`/orders/${encodeURIComponent(id)}/pay`, {
    method: 'POST',
    body: { card_last_four: cardLastFour },
  });
  return toOrder(order);
}

export function downloadInvoice(id) {
  return download(`/orders/${encodeURIComponent(id)}/invoice`);
}
