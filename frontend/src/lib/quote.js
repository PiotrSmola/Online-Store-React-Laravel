import { ApiError } from './api';
import { lineKey } from './cart';
import { getProduct } from './catalog';
import { cleanOptions } from './product';
import { DELIVERY_METHODS } from './shopConfig';

const UNAVAILABLE = 'Ten produkt jest już niedostępny';
const CACHE_TTL_MS = 60_000;

// Changing a quantity sends no request, and views of the same cart share one. Entries hold the
// promise, so a request still in flight is reused too.
const productCache = new Map();

function fetchProduct(id) {
  return getProduct(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    productCache.delete(id);
    throw error;
  });
}

function loadProduct(id) {
  const cached = productCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const entry = { expiresAt: Date.now() + CACHE_TTL_MS, promise: fetchProduct(id) };
  productCache.set(id, entry);
  return entry.promise;
}

/** The requests are shared, so one caller's abort only ends that caller's wait for them. */
function untilAborted(promise, signal) {
  if (!signal) return promise;

  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));

    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });

    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function toGrosze(amount) {
  return Math.round(Number.parseFloat(amount) * 100);
}

function lineError(item, product) {
  if (!product) return UNAVAILABLE;

  const sizes = cleanOptions(product.rozmiar);
  const colors = cleanOptions(product.kolor);
  const sizeMissing = sizes.length > 0 ? !sizes.includes(item.size) : item.size !== null;
  const colorMissing = colors.length > 0 ? !colors.includes(item.color) : item.color !== null;

  return sizeMissing || colorMissing ? `Ten wariant produktu „${product.nazwa}” jest niedostępny` : null;
}

function toLine(item, product) {
  const unitPrice = product ? toGrosze(product.cena) : 0;
  const error = lineError(item, product);

  return {
    key: lineKey(item),
    product,
    size: item.size,
    color: item.color,
    quantity: item.quantity,
    unit_price: unitPrice / 100,
    line_total: (unitPrice * item.quantity) / 100,
    available: error === null,
    error,
  };
}

/**
 * Prices the cart. This API has no quote endpoint yet, so the numbers are worked out from the
 * products. The result has the shape of POST /api/cart/quote, which replaces this function: only
 * this file changes then. The order total is always decided by the server.
 */
export async function quoteCart(items, { deliveryMethod = null, signal } = {}) {
  const products = await untilAborted(
    Promise.all(items.map((item) => loadProduct(item.product_id))),
    signal,
  );
  const lines = items.map((item, index) => toLine(item, products[index]));

  const subtotal = lines.reduce((sum, line) => sum + (line.available ? toGrosze(line.line_total) : 0), 0);
  const deliveryPrice = DELIVERY_METHODS.find((method) => method.value === deliveryMethod)?.price ?? null;

  return {
    lines,
    subtotal: subtotal / 100,
    delivery_options: DELIVERY_METHODS,
    delivery_price: deliveryPrice,
    total: (subtotal + toGrosze(deliveryPrice ?? 0)) / 100,
  };
}
