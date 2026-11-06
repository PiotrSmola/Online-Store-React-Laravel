import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, download, getToken, isAbortError, onUnauthorized, request, saveFile, storeToken } from './api';
import { signIn, verifySession } from './session';

const TOKEN = 'token-123';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function respondWith(status, body) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(status, body));
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the request to fail');
}

beforeEach(() => {
  const data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('returns the parsed body', async () => {
    respondWith(200, { id: 1 });
    await expect(request('/products/1')).resolves.toEqual({ id: 1 });
  });

  it('calls the path below the API root', async () => {
    const fetchMock = respondWith(200, []);
    await request('/products');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/products$/);
  });

  it('sends the bearer token when one is stored', async () => {
    storeToken(TOKEN);
    const fetchMock = respondWith(200, {});
    await request('/orders');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('sends no Authorization header without a token', async () => {
    const fetchMock = respondWith(200, {});
    await request('/products');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends a body as JSON', async () => {
    const fetchMock = respondWith(200, {});
    await request('/orders', { method: 'POST', body: { a: 1 } });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe('{"a":1}');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('passes the abort signal on', async () => {
    const fetchMock = respondWith(200, {});
    const { signal } = new AbortController();
    await request('/products', { signal });
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });
});

describe('uploads and downloads', () => {
  it('sends a FormData body as it is, so the browser sets the boundary', async () => {
    const fetchMock = respondWith(201, { id: 1 });
    const body = new FormData();
    body.append('image', 'x');

    await request('/admin/products/1/images', { method: 'POST', body });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(body);
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('downloads a file with the bearer header and its server name', async () => {
    storeToken(TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('PDF', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="faktura-1.pdf"' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = await download('/orders/1/invoice');

    expect(file.name).toBe('faktura-1.pdf');
    expect(await file.blob.text()).toBe('PDF');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('reads a failed download as JSON', async () => {
    respondWith(409, { message: 'Faktura będzie dostępna po opłaceniu.' });
    expect((await failure(download('/orders/1/invoice'))).status).toBe(409);
  });

  it('revokes the object URL after saving', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:1', revokeObjectURL: revoke });
    vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });

    saveFile({ blob: new Blob(['x']), name: 'a.pdf' });

    vi.advanceTimersByTime(999);
    expect(revoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith('blob:1');
    vi.useRealTimers();
  });
});

describe('rate limits', () => {
  it('turns Retry-After into a concrete wait', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.' }), { status: 429, headers: { 'Retry-After': '42' } }),
    ));

    expect((await failure(request('/contact'))).message).toBe('Zbyt wiele prób. Spróbuj ponownie za 42 s.');
  });

  it('keeps a specific message such as the open order limit', async () => {
    const message = 'Masz zbyt wiele nieopłaconych zamówień.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message }), { status: 429 })));

    expect((await failure(request('/orders'))).message).toBe(message);
  });

  it('keeps the response body for a declined payment', async () => {
    respondWith(402, { message: 'Odrzucono', order: { id: 1 } });
    expect((await failure(request('/orders/1/pay'))).data.order.id).toBe(1);
  });
});

describe('error normalisation', () => {
  it('turns a validation response into message, errors and status', async () => {
    respondWith(422, { message: 'Błędy walidacji', errors: { email: ['Zajęty'] } });

    const error = await failure(request('/orders'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Błędy walidacji');
    expect(error.errors).toEqual({ email: ['Zajęty'] });
    expect(error.status).toBe(422);
  });

  it('gives an empty errors object when the response has none', async () => {
    respondWith(404, { message: 'Nie znaleziono' });
    expect((await failure(request('/products/9'))).errors).toEqual({});
  });

  it('keeps a server message written for customers', async () => {
    respondWith(500, { message: 'Nie udało się złożyć zamówienia.' });
    expect((await failure(request('/orders'))).message).toBe('Nie udało się złożyć zamówienia.');
  });

  it("replaces Laravel's English 500 message with a Polish one", async () => {
    respondWith(500, { message: 'Server Error' });
    expect((await failure(request('/orders'))).message).toMatch(/po naszej stronie/);
  });

  it('copes with a response that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));

    const error = await failure(request('/products'));

    expect(error.status).toBe(502);
    expect(error.message).toMatch(/po naszej stronie/);
    expect(error.errors).toEqual({});
  });

  it('uses a general message for a client error with no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400 })));
    expect((await failure(request('/products'))).message).toBe('Nie udało się wykonać tej operacji.');
  });

  it('reports a lost connection with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await failure(request('/products'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/połączyć/);
  });

  it('lets an abort through unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));

    const error = await failure(request('/products'));

    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});

describe('401 flow', () => {
  let listener;
  let unsubscribe;

  beforeEach(() => {
    listener = vi.fn();
    unsubscribe = onUnauthorized(listener);
  });

  afterEach(() => {
    unsubscribe();
  });

  it('clears the token and tells the listeners', async () => {
    storeToken(TOKEN);
    respondWith(401, { message: 'Unauthenticated.' });

    const error = await failure(request('/orders'));

    expect(error.status).toBe(401);
    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('does nothing extra for a guest', async () => {
    respondWith(401, { message: 'Unauthenticated.' });
    await failure(request('/orders'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('leaves the session alone with quiet401', async () => {
    storeToken(TOKEN);
    respondWith(401, { message: 'Unauthenticated.' });

    await failure(request('/customer/me', { quiet401: true }));

    expect(getToken()).toBe(TOKEN);
    expect(listener).not.toHaveBeenCalled();
  });

  it('leaves the session alone on other errors', async () => {
    storeToken(TOKEN);
    respondWith(500, {});

    await failure(request('/orders'));

    expect(getToken()).toBe(TOKEN);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops calling a listener after it unsubscribes', async () => {
    unsubscribe();
    storeToken(TOKEN);
    respondWith(401, {});

    await failure(request('/orders'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the session when a login attempt is refused with 401', async () => {
    storeToken(TOKEN);
    respondWith(401, { message: 'Podane dane logowania są nieprawidłowe.' });

    const error = await failure(signIn({ email: 'a@b.pl', password: 'zle' }));

    expect(error.message).toBe('Podane dane logowania są nieprawidłowe.');
    expect(getToken()).toBe(TOKEN);
    expect(listener).not.toHaveBeenCalled();
  });

  it('ends the session when verifySession finds a dead token', async () => {
    storeToken(TOKEN);
    respondWith(401, { message: 'Unauthenticated.' });

    await failure(verifySession());

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('ends the session when another tab already removed the token', async () => {
    respondWith(401, { message: 'Unauthenticated.' });

    await failure(verifySession());

    expect(listener).toHaveBeenCalledOnce();
  });

  it('resolves verifySession for a live token', async () => {
    storeToken(TOKEN);
    respondWith(200, { id: 1 });

    await expect(verifySession()).resolves.toEqual({ id: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
