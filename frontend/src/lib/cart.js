export const MAX_QUANTITY = 99;

const STORAGE_KEY = 'cart';

function option(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

export function clampQuantity(quantity) {
  const whole = Math.trunc(Number(quantity));
  if (!Number.isFinite(whole) || whole < 1) return 1;
  return Math.min(whole, MAX_QUANTITY);
}

/** One line per product, size and color. Matches the key the cart quote returns. */
export function lineKey({ product_id: productId, size, color }) {
  return `${productId}:${size ?? ''}:${color ?? ''}`;
}

export function addLine(items, { product_id: productId, size = null, color = null, quantity = 1 }) {
  const added = { product_id: productId, size: option(size), color: option(color), quantity: clampQuantity(quantity) };
  const key = lineKey(added);

  if (!items.some((item) => lineKey(item) === key)) return [...items, added];

  return items.map((item) =>
    lineKey(item) === key ? { ...item, quantity: clampQuantity(item.quantity + added.quantity) } : item,
  );
}

export function setLineQuantity(items, key, quantity) {
  return items.map((item) => (lineKey(item) === key ? { ...item, quantity: clampQuantity(quantity) } : item));
}

export function removeLine(items, key) {
  return items.filter((item) => lineKey(item) !== key);
}

export function countItems(items) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

// Carts saved before this format held the whole product: { product, selectedSize, selectedColor }.
function toStoredLine(entry) {
  return {
    product_id: Number(entry?.product_id ?? entry?.product?.id),
    size: entry?.size ?? entry?.selectedSize,
    color: entry?.color ?? entry?.selectedColor,
    quantity: entry?.quantity,
  };
}

/** Turns whatever was stored into valid lines and merges duplicates. */
export function normalizeCart(stored) {
  if (!Array.isArray(stored)) return [];

  return stored
    .map(toStoredLine)
    .filter((line) => Number.isInteger(line.product_id) && line.product_id > 0)
    .reduce(addLine, []);
}

export function readCart(storage) {
  try {
    return normalizeCart(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return [];
  }
}

export function writeCart(storage, items) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // A full or blocked storage keeps the cart in memory until the next reload.
  }
}
