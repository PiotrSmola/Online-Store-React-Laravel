import { ApiError } from './api';
import { lineKey } from './cart';
import { getProduct } from './catalog';
import { cleanOptions } from './product';
import { DELIVERY_METHODS } from './shopConfig';

const UNAVAILABLE = 'Ten produkt jest już niedostępny';

// Prices are read once per page load, so changing a quantity sends no request.
const productCache = new Map();

async function loadProduct(id, signal) {
  if (productCache.has(id)) return productCache.get(id);

  try {
    const product = await getProduct(id, { signal });
    productCache.set(id, product);
    return product;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
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
  const products = await Promise.all(items.map((item) => loadProduct(item.product_id, signal)));
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
