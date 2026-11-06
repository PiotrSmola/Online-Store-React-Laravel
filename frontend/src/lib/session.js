import { request } from './api';

export function signIn(credentials) {
  return request('/customer/login', { method: 'POST', body: credentials });
}

export function signOut() {
  return request('/customer/logout', { method: 'POST', quiet401: true });
}

/** quiet401: a stale token found while the app loads is no reason to leave the page. */
export function getCurrentCustomer({ signal } = {}) {
  return request('/customer/me', { signal, quiet401: true });
}
