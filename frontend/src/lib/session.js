import { request } from './api';

/** quiet401: a refused password says nothing about a token that happens to be stored. */
export function signIn(credentials) {
  return request('/customer/login', { method: 'POST', body: credentials, quiet401: true });
}

export function register(account) {
  return request('/customer/register', { method: 'POST', body: account });
}

export function signOut() {
  return request('/customer/logout', { method: 'POST', quiet401: true });
}

/** quiet401: a stale token found while the app loads is no reason to leave the page. */
export function getCurrentCustomer({ signal } = {}) {
  return request('/customer/me', { signal, quiet401: true });
}

/**
 * Proves the session still works, for endpoints that treat a bad token as a guest instead of
 * refusing it. A refused token ends the session the usual way: logout and a redirect to login.
 */
export function verifySession() {
  return request('/customer/me', { expectSession: true });
}

export function forgotPassword(email) {
  return request('/customer/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(details) {
  return request('/customer/reset-password', { method: 'POST', body: details });
}

export function updateProfile(profile) {
  return request('/customer/profile', { method: 'PUT', body: profile });
}

export function updatePassword(passwords) {
  return request('/customer/password', { method: 'PUT', body: passwords });
}
