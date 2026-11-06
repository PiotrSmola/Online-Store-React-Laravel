import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY,
  addLine,
  cartFromStorageEvent,
  clampQuantity,
  countItems,
  lineKey,
  normalizeCart,
  readCart,
  removeLine,
  setLineQuantity,
  writeCart,
} from './cart';

const shirt = { product_id: 1, size: 'M', color: 'Czarny', quantity: 2 };
const belt = { product_id: 2, size: null, color: null, quantity: 1 };

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

describe('lineKey', () => {
  it('combines product, size and color', () => {
    expect(lineKey(shirt)).toBe('1:M:Czarny');
  });

  it('leaves missing options empty', () => {
    expect(lineKey(belt)).toBe('2::');
  });

  it('gives each variant of a product its own key', () => {
    expect(lineKey(shirt)).not.toBe(lineKey({ ...shirt, size: 'L' }));
    expect(lineKey(shirt)).not.toBe(lineKey({ ...shirt, color: 'Biały' }));
  });
});

describe('clampQuantity', () => {
  it.each([
    [1, 1],
    [50, 50],
    [0, 1],
    [-3, 1],
    [2.9, 2],
    ['7', 7],
    ['', 1],
    [NaN, 1],
    [1000, MAX_QUANTITY],
  ])('turns %j into %i', (input, expected) => {
    expect(clampQuantity(input)).toBe(expected);
  });
});

describe('addLine', () => {
  it('appends a new variant without changing the input', () => {
    const items = [shirt];
    const result = addLine(items, belt);

    expect(result).toEqual([shirt, belt]);
    expect(items).toEqual([shirt]);
  });

  it('adds to the quantity of the same variant', () => {
    expect(addLine([shirt], { ...shirt, quantity: 3 })).toEqual([{ ...shirt, quantity: 5 }]);
  });

  it('keeps a different size on its own line', () => {
    expect(addLine([shirt], { ...shirt, size: 'L' })).toHaveLength(2);
  });

  it('stores only product id, size, color and quantity', () => {
    const [line] = addLine([], { ...belt, nazwa: 'Pasek', cena: '99.00', extra: true });
    expect(Object.keys(line).sort()).toEqual(['color', 'product_id', 'quantity', 'size']);
  });

  it('treats blank options as no option', () => {
    expect(addLine([], { product_id: 2, size: '', color: '  ' })).toEqual([belt]);
  });

  it('stops at the maximum quantity', () => {
    expect(addLine([{ ...shirt, quantity: 98 }], { ...shirt, quantity: 5 })[0].quantity).toBe(MAX_QUANTITY);
  });
});

describe('setLineQuantity', () => {
  it('changes only the matching line', () => {
    expect(setLineQuantity([shirt, belt], lineKey(belt), 4)).toEqual([shirt, { ...belt, quantity: 4 }]);
  });

  it('never goes below one', () => {
    expect(setLineQuantity([shirt], lineKey(shirt), 0)[0].quantity).toBe(1);
  });
});

describe('removeLine', () => {
  it('removes the matching line', () => {
    expect(removeLine([shirt, belt], lineKey(shirt))).toEqual([belt]);
  });
});

describe('countItems', () => {
  it('adds up quantities', () => {
    expect(countItems([shirt, belt])).toBe(3);
    expect(countItems([])).toBe(0);
  });
});

describe('normalizeCart', () => {
  it('converts a cart saved in the old format', () => {
    const legacy = [
      {
        id: '1-M-Czarny',
        product: { id: 1, nazwa: 'Koszula', cena: '100.00', images: [] },
        selectedSize: 'M',
        selectedColor: 'Czarny',
        quantity: 2,
      },
    ];

    expect(normalizeCart(legacy)).toEqual([shirt]);
  });

  it('drops entries without a product and merges duplicates', () => {
    expect(normalizeCart([shirt, shirt, { quantity: 1 }, null, 'text'])).toEqual([{ ...shirt, quantity: 4 }]);
  });

  it('returns an empty cart for anything that is not a list', () => {
    expect(normalizeCart({ a: 1 })).toEqual([]);
    expect(normalizeCart(null)).toEqual([]);
  });
});

describe('storage', () => {
  it('writes and reads the same cart', () => {
    const storage = memoryStorage();
    writeCart(storage, [shirt, belt]);
    expect(readCart(storage)).toEqual([shirt, belt]);
  });

  it('returns an empty cart when the stored value is broken', () => {
    expect(readCart(memoryStorage({ cart: '{not json' }))).toEqual([]);
  });

  it('returns an empty cart when nothing is stored', () => {
    expect(readCart(memoryStorage())).toEqual([]);
  });

  it('writes the exact text it would read back, so a second tab fires no further event', () => {
    const storage = memoryStorage();
    writeCart(storage, [shirt, belt]);
    const saved = storage.getItem('cart');

    writeCart(storage, cartFromStorageEvent({ key: 'cart', newValue: saved }));
    expect(storage.getItem('cart')).toBe(saved);
  });
});

describe('cartFromStorageEvent', () => {
  it('reads the cart another tab saved', () => {
    expect(cartFromStorageEvent({ key: 'cart', newValue: JSON.stringify([shirt]) })).toEqual([shirt]);
  });

  it('ignores other keys', () => {
    expect(cartFromStorageEvent({ key: 'customerToken', newValue: 'abc' })).toBeNull();
  });

  it('empties the cart when another tab removes it', () => {
    expect(cartFromStorageEvent({ key: 'cart', newValue: null })).toEqual([]);
  });

  it('empties the cart when storage is cleared', () => {
    expect(cartFromStorageEvent({ key: null, newValue: null })).toEqual([]);
  });

  it('treats a broken value as an empty cart', () => {
    expect(cartFromStorageEvent({ key: 'cart', newValue: '{not json' })).toEqual([]);
  });
});
