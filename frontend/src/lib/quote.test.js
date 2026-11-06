import { afterEach, describe, expect, it, vi } from 'vitest';
import { quoteCart, toQuoteItems } from './quote';

function stubFetch(body = { lines: [] }) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

const sentBody = (mock) => JSON.parse(mock.mock.calls[0][1].body);

const items = [
  { product_id: 1, size: 'M', color: 'Czarny', quantity: 2 },
  { product_id: 2, size: null, color: null, quantity: 1 },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('quoteCart', () => {
  it('posts to the quote endpoint and returns the server result', async () => {
    const quote = { lines: [], subtotal: 10, total: 25.99 };
    const mock = stubFetch(quote);

    await expect(quoteCart(items)).resolves.toEqual(quote);
    expect(mock.mock.calls[0][0]).toMatch(/\/api\/cart\/quote$/);
    expect(mock.mock.calls[0][1].method).toBe('POST');
  });

  it('sends ids and options, never a price', async () => {
    const mock = stubFetch();
    await quoteCart(items);

    expect(sentBody(mock).items).toEqual([{ product_id: 1, quantity: 2, size: 'M', color: 'Czarny' }, { product_id: 2, quantity: 1 }]);
  });

  it('adds the coupon and delivery method when there are any', async () => {
    const mock = stubFetch();
    await quoteCart(items, { coupon: 'WITAJ10', deliveryMethod: 'courier' });

    expect(sentBody(mock)).toMatchObject({ coupon: 'WITAJ10', delivery_method: 'courier' });
  });

  it('leaves out an empty coupon and delivery method', async () => {
    const mock = stubFetch();
    await quoteCart(items, { coupon: '', deliveryMethod: null });

    expect(Object.keys(sentBody(mock))).toEqual(['items']);
  });

  it('passes the abort signal on', async () => {
    const mock = stubFetch();
    const { signal } = new AbortController();
    await quoteCart(items, { signal });

    expect(mock.mock.calls[0][1].signal).toBe(signal);
  });
});

describe('toQuoteItems', () => {
  it('uses the names of the cart endpoints', () => {
    expect(Object.keys(toQuoteItems([items[0]])[0]).sort()).toEqual(['color', 'product_id', 'quantity', 'size']);
  });
});
