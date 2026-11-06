import { download, request } from './api';
import { toPage, toSearch } from './catalog';
import { toOrder } from './orders';

async function getPage(path, query, signal) {
  return toPage(await request(`${path}${toSearch(query)}`, { signal }));
}

function id(value) {
  return encodeURIComponent(value);
}

export function getStats({ signal } = {}) {
  return request('/admin/stats', { signal });
}

export function getAdminProducts(query, { signal } = {}) {
  return getPage('/admin/products', query, signal);
}

export function getAdminProduct(productId, { signal } = {}) {
  return request(`/admin/products/${id(productId)}`, { signal });
}

export function createProduct(product) {
  return request('/admin/products', { method: 'POST', body: product });
}

export function updateProduct(productId, product) {
  return request(`/admin/products/${id(productId)}`, { method: 'PUT', body: product });
}

export function deleteProduct(productId) {
  return request(`/admin/products/${id(productId)}`, { method: 'DELETE' });
}

export function uploadProductImage(productId, file) {
  const body = new FormData();
  body.append('image', file);
  return request(`/admin/products/${id(productId)}/images`, { method: 'POST', body });
}

export function deleteProductImage(productId, imageId) {
  return request(`/admin/products/${id(productId)}/images/${id(imageId)}`, { method: 'DELETE' });
}

export function getAdminOrders(query, { signal } = {}) {
  return getPage('/admin/orders', query, signal);
}

export async function getAdminOrder(orderId, { signal } = {}) {
  return toOrder(await request(`/admin/orders/${id(orderId)}`, { signal }));
}

export async function updateOrderStatus(orderId, change) {
  return toOrder(await request(`/admin/orders/${id(orderId)}/status`, { method: 'PATCH', body: change }));
}

export async function markOrderPaid(orderId) {
  return toOrder(await request(`/admin/orders/${id(orderId)}/payment`, { method: 'PATCH' }));
}

export function downloadAdminInvoice(orderId) {
  return download(`/admin/orders/${id(orderId)}/invoice`);
}

export function getCustomers(query, { signal } = {}) {
  return getPage('/admin/customers', query, signal);
}

export function getCoupons(query, { signal } = {}) {
  return getPage('/admin/coupons', query, signal);
}

export function getCoupon(couponId, { signal } = {}) {
  return request(`/admin/coupons/${id(couponId)}`, { signal });
}

export function createCoupon(coupon) {
  return request('/admin/coupons', { method: 'POST', body: coupon });
}

export function updateCoupon(couponId, coupon) {
  return request(`/admin/coupons/${id(couponId)}`, { method: 'PUT', body: coupon });
}

export function deleteCoupon(couponId) {
  return request(`/admin/coupons/${id(couponId)}`, { method: 'DELETE' });
}

export function getMessages(query, { signal } = {}) {
  return getPage('/admin/messages', query, signal);
}

export function markMessageRead(messageId) {
  return request(`/admin/messages/${id(messageId)}/read`, { method: 'PATCH' });
}

export function deleteMessage(messageId) {
  return request(`/admin/messages/${id(messageId)}`, { method: 'DELETE' });
}

export function getSubscribers(query, { signal } = {}) {
  return getPage('/admin/newsletter', query, signal);
}

export function exportSubscribers() {
  return download('/admin/newsletter/export');
}
