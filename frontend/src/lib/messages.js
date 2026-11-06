import { request } from './api';

export function sendContactMessage(message) {
  return request('/contact', { method: 'POST', body: message });
}

export function subscribeToNewsletter(email) {
  return request('/newsletter/subscribe', { method: 'POST', body: { email } });
}

export function confirmNewsletter(token) {
  return request('/newsletter/confirm', { method: 'POST', body: { token } });
}

export function unsubscribeFromNewsletter(token) {
  return request('/newsletter/unsubscribe', { method: 'POST', body: { token } });
}
