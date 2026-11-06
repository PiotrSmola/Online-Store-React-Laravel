import { API_URL } from '../config';
import { safeStorage } from './storage';

const TOKEN_KEY = 'customerToken';
const NETWORK_MESSAGE = 'Nie udało się połączyć ze sklepem. Sprawdź połączenie i spróbuj ponownie.';
const SERVER_MESSAGE = 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.';
const CLIENT_MESSAGE = 'Nie udało się wykonać tej operacji.';

const unauthorizedListeners = new Set();

/** Every failed request rejects with this: { message, errors, status, data }. */
export class ApiError extends Error {
  constructor(message, { errors = {}, status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.errors = errors;
    this.status = status;
    this.data = data;
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

function errorMessage(response, data) {
  const fallback = response.status >= 500 ? SERVER_MESSAGE : CLIENT_MESSAGE;
  const message = typeof data?.message === 'string' && data.message !== 'Server Error' ? data.message : fallback;
  const retryAfter = Number(response.headers.get('Retry-After'));

  return response.status === 429 && retryAfter > 0 ? message.replace('za chwilę', `za ${retryAfter} s`) : message;
}

async function send(path, options) {
  const { method = 'GET', body, signal, keepalive, quiet401 = false, expectSession = false } = options;
  const token = getToken();
  const isForm = body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      signal,
      keepalive,
      body: isForm || body === undefined ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(NETWORK_MESSAGE);
  }

  if (response.ok) return response;

  const data = await readJson(response);

  if (response.status === 401 && (token || expectSession) && !quiet401) {
    storeToken(null);
    unauthorizedListeners.forEach((listener) => listener());
  }

  throw new ApiError(errorMessage(response, data), { errors: data?.errors ?? {}, status: response.status, data });
}

/**
 * @param {string} path Path below the API root, for example "/products".
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body] Sent as JSON, or as multipart when it is a FormData.
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.keepalive] Lets the request outlive the page.
 * @param {boolean} [options.quiet401] A 401 only rejects, for calls that check the session itself.
 * @param {boolean} [options.expectSession] A 401 ends the session even with no stored token, which
 *   another tab may have removed while this one still shows the customer as signed in.
 */
export async function request(path, options = {}) {
  return readJson(await send(path, options));
}

function fileName(response) {
  const header = response.headers.get('Content-Disposition') ?? '';
  return /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)?.[1] ?? 'plik';
}

/** Fetches a file with the bearer header. Resolves to { blob, name }. */
export async function download(path, options = {}) {
  const response = await send(path, options);
  return { blob: await response.blob(), name: fileName(response) };
}

// The browser reads the object URL after click() returns, and some need a moment to start.
const REVOKE_DELAY_MS = 1000;

/** Hands a blob to the browser as a download and frees its object URL afterwards. */
export function saveFile({ blob, name }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
