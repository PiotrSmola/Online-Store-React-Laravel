import { API_URL } from '../config';
import { safeStorage } from './storage';

const TOKEN_KEY = 'customerToken';
const NETWORK_MESSAGE = 'Nie udało się połączyć ze sklepem. Sprawdź połączenie i spróbuj ponownie.';
const SERVER_MESSAGE = 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.';

const unauthorizedListeners = new Set();

/** Every failed request rejects with this: { message, errors, status }. */
export class ApiError extends Error {
  constructor(message, { errors = {}, status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.errors = errors;
    this.status = status;
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

export function getToken() {
  return safeStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) safeStorage.setItem(TOKEN_KEY, token);
  else safeStorage.removeItem(TOKEN_KEY);
}

/** Runs the listener when a signed-in request is refused. Returns the unsubscribe function. */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiError(response, data) {
  const fallback = response.status >= 500 ? SERVER_MESSAGE : 'Nie udało się wykonać tej operacji.';
  const message = typeof data?.message === 'string' && data.message !== 'Server Error' ? data.message : fallback;
  return new ApiError(message, { errors: data?.errors ?? {}, status: response.status });
}

/**
 * @param {string} path Path below the API root, for example "/products".
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body] Sent as JSON.
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.quiet401] A 401 only rejects, for calls that check the session itself.
 * @param {boolean} [options.expectSession] A 401 ends the session even with no stored token, which
 *   another tab may have removed while this one still shows the customer as signed in.
 */
export async function request(path, { method = 'GET', body, signal, quiet401 = false, expectSession = false } = {}) {
  const token = getToken();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(NETWORK_MESSAGE);
  }

  const data = await readJson(response);
  if (response.ok) return data;

  if (response.status === 401 && (token || expectSession) && !quiet401) {
    storeToken(null);
    unauthorizedListeners.forEach((listener) => listener());
  }

  throw toApiError(response, data);
}
