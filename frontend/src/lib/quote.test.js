import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProduct } from './catalog';

vi.mock('./catalog', () => ({ getProduct: vi.fn() }));

const jacket = { id: 1, nazwa: 'Kurtka', cena: '19.99', rozmiar: ['M', 'L'], kolor: ['Czarny'] };
const belt = { id: 2, nazwa: 'Pasek', cena: '0.10', rozmiar: [], kolor: null };
const PRODUCTS = { 1: jacket, 2: belt };

const jacketLine = { product_id: 1, size: 'M', color: 'Czarny', quantity: 3 };
const beltLine = { product_id: 2, size: null, color: null, quantity: 3 };

let quoteCart;
let ApiError;

beforeEach(async () => {
  // Each test starts with an empty product cache. ApiError comes from the same fresh modules.
  vi.resetModules();
  ({ quoteCart } = await import('./quote'));
  ({ ApiError } = await import('./api'));
  getProduct.mockReset();
  getProduct.mockImplementation(async (id) => PRODUCTS[id]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('prices', () => {
  it('prices each line and adds up in grosze', async () => {
    const quote = await quoteCart([jacketLine, beltLine]);

    expect(quote.lines[0]).toMatchObject({ key: '1:M:Czarny', unit_price: 19.99, line_total: 59.97, available: true, error: null });
    expect(quote.lines[1]).toMatchObject({ key: '2::', line_total: 0.3, available: true });
    expect(quote.subtotal).toBe(60.27);
    expect(quote.total).toBe(60.27);
  });

  it('adds the delivery price of the chosen method', async () => {
    const quote = await quoteCart([jacketLine], { deliveryMethod: 'courier' });

    expect(quote.delivery_price).toBe(15.99);
    expect(quote.total).toBe(75.96);
  });

  it('treats store pickup as a free method, not a missing one', async () => {
    const quote = await quoteCart([jacketLine], { deliveryMethod: 'store_pickup' });

    expect(quote.delivery_price).toBe(0);
    expect(quote.total).toBe(59.97);
  });

  it('has no delivery price before a method is chosen', async () => {
    expect((await quoteCart([jacketLine])).delivery_price).toBeNull();
  });

  it('has no delivery price for an unknown method', async () => {
    expect((await quoteCart([jacketLine], { deliveryMethod: 'drone' })).delivery_price).toBeNull();
  });

  it('lists the delivery options', async () => {
    const quote = await quoteCart([jacketLine]);
    expect(quote.delivery_options.map((method) => method.value)).toEqual(['courier', 'pickup_point', 'store_pickup']);
  });
});

describe('unavailable lines', () => {
  it('marks a deleted product and leaves it out of the total', async () => {
    getProduct.mockImplementation(async (id) => {
      if (id === 2) throw new ApiError('Nie znaleziono', { status: 404 });
      return jacket;
    });

    const quote = await quoteCart([jacketLine, beltLine]);

    expect(quote.lines[1]).toMatchObject({ product: null, available: false, error: 'Ten produkt jest już niedostępny' });
    expect(quote.subtotal).toBe(59.97);
  });

  it('marks a size the product does not have', async () => {
    const [line] = (await quoteCart([{ ...jacketLine, size: 'XXL' }])).lines;
    expect(line.available).toBe(false);
    expect(line.error).toContain('Kurtka');
  });

  it('marks a missing size on a product that has sizes', async () => {
    expect((await quoteCart([{ ...jacketLine, size: null }])).lines[0].available).toBe(false);
  });

  it('marks a color the product does not have', async () => {
    expect((await quoteCart([{ ...jacketLine, color: 'Różowy' }])).lines[0].available).toBe(false);
  });

  it('marks an option on a product without options', async () => {
    expect((await quoteCart([{ ...beltLine, size: 'M' }])).lines[0].available).toBe(false);
  });

  it('accepts no options on a product with blank options', async () => {
    getProduct.mockResolvedValue({ ...belt, rozmiar: ['', ' '], kolor: [null] });
    expect((await quoteCart([beltLine])).lines[0].available).toBe(true);
  });
});

describe('cache', () => {
  it('sends one request for concurrent quotes of the same product', async () => {
    await Promise.all([quoteCart([jacketLine]), quoteCart([jacketLine])]);
    expect(getProduct).toHaveBeenCalledOnce();
  });

  it('sends no request when only the quantity changes', async () => {
    await quoteCart([jacketLine]);
    await quoteCart([{ ...jacketLine, quantity: 5 }]);
    expect(getProduct).toHaveBeenCalledOnce();
  });

  it('asks again after the entry expires', async () => {
    vi.useFakeTimers();

    await quoteCart([jacketLine]);
    vi.advanceTimersByTime(59_000);
    await quoteCart([jacketLine]);
    expect(getProduct).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(2_000);
    await quoteCart([jacketLine]);
    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('shows a changed price after the entry expires', async () => {
    vi.useFakeTimers();

    await quoteCart([jacketLine]);
    getProduct.mockResolvedValue({ ...jacket, cena: '25.00' });
    vi.advanceTimersByTime(61_000);

    expect((await quoteCart([jacketLine])).subtotal).toBe(75);
  });

  it('rejects on a failure and does not keep it', async () => {
    getProduct.mockRejectedValueOnce(new ApiError('Błąd', { status: 500 }));

    await expect(quoteCart([jacketLine])).rejects.toThrow('Błąd');
    await expect(quoteCart([jacketLine])).resolves.toMatchObject({ subtotal: 59.97 });
    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('remembers a deleted product until the entry expires', async () => {
    getProduct.mockRejectedValue(new ApiError('Nie znaleziono', { status: 404 }));

    await quoteCart([beltLine]);
    await quoteCart([beltLine]);

    expect(getProduct).toHaveBeenCalledOnce();
  });
});

describe('aborting', () => {
  it('rejects with an AbortError when the signal is already aborted', async () => {
    await expect(quoteCart([jacketLine], { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects when aborted while waiting', async () => {
    let finish;
    getProduct.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();

    const quote = quoteCart([jacketLine], { signal: controller.signal });
    controller.abort();

    await expect(quote).rejects.toMatchObject({ name: 'AbortError' });
    finish(jacket);
  });

  it("does not end another caller's wait for the shared request", async () => {
    let finish;
    getProduct.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();

    const aborted = quoteCart([jacketLine], { signal: controller.signal });
    const kept = quoteCart([jacketLine]);
    controller.abort();
    finish(jacket);

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    await expect(kept).resolves.toMatchObject({ subtotal: 59.97 });
    expect(getProduct).toHaveBeenCalledOnce();
  });
});
