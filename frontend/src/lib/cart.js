export const MAX_QUANTITY = 99;

const STORAGE_KEY = 'cart';
const OWNER_KEY = 'cartOwner';

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

/** A quote's lines as cart lines. The server writes a missing option as an empty string. */
export function cartFromQuote(quote) {
  return quote.lines.reduce((items, line) => addLine(items, line), []);
}

/**
 * Joins the browser's cart and the account's. The higher quantity of a line wins, not the sum, so
 * running this again after a reload changes nothing.
 */
export function mergeCarts(local, saved) {
  return saved.reduce((items, line) => {
    const key = lineKey(line);
    const existing = items.find((item) => lineKey(item) === key);
    if (!existing) return addLine(items, line);
    return setLineQuantity(items, key, Math.max(existing.quantity, line.quantity));
  }, local);
}

/** Text to compare two carts by, regardless of line order. */
export function cartFingerprint(items) {
  return items.map((item) => `${lineKey(item)}=${item.quantity}`).sort().join('|');
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

function parseCart(json) {
  try {
    return normalizeCart(JSON.parse(json));
  } catch {
    return [];
  }
}

export function readCart(storage) {
  return parseCart(storage.getItem(STORAGE_KEY));
}

/** An empty cart leaves nothing behind, so a logout removes the key. */
export function writeCart(storage, items) {
  if (items.length === 0) storage.removeItem(STORAGE_KEY);
  else storage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * The customer whose lines the browser holds. A session can expire with a cart still here, and
 * these lines must return to that customer, never join the next person's account.
 */
export function readCartOwner(storage) {
  return storage.getItem(OWNER_KEY);
}

export function writeCartOwner(storage, owner) {
  if (owner === null) storage.removeItem(OWNER_KEY);
  else storage.setItem(OWNER_KEY, owner);
}

/** The owner another tab saved, or undefined for any other key. A null key means a full clear. */
export function ownerFromStorageEvent({ key, newValue }) {
  if (key === null) return null;
  return key === OWNER_KEY ? newValue : undefined;
}

/** The cart another tab saved, or null for any other key. A null key means storage was cleared. */
export function cartFromStorageEvent({ key, newValue }) {
  return key === STORAGE_KEY || key === null ? parseCart(newValue) : null;
}
