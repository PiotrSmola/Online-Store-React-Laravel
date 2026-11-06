import { describe, expect, it } from 'vitest';
import { buildProductPayload, emptyProduct, emptyVariant, productToForm, validateProduct } from './productForm';

const loaded = {
  nazwa: 'Kurtka',
  kategoria: 'Kurtki',
  cena: '549.99',
  sale_price: null,
  opis: 'Opis',
  is_active: true,
  is_new: false,
  variants: [{ id: 3, size: 'M', color: 'Czarny', stock: 10 }],
};

const valid = { ...emptyProduct(), nazwa: 'Kurtka', kategoria: 'Kurtki', cena: '100', opis: 'Opis' };

describe('productToForm', () => {
  it('remembers the loaded stock of each variant', () => {
    expect(productToForm(loaded).variants[0]).toMatchObject({ size: 'M', stock: '10', original_stock: 10 });
  });

  it('shows no sale price as an empty field', () => {
    expect(productToForm(loaded).sale_price).toBe('');
  });
});

describe('buildProductPayload', () => {
  it('sends original_stock for a variant that exists', () => {
    const form = productToForm(loaded);
    form.variants[0].stock = '15';

    expect(buildProductPayload(form).variants[0]).toEqual({ size: 'M', color: 'Czarny', stock: 15, original_stock: 10 });
  });

  it('sends only the stock for a new variant', () => {
    const form = productToForm(loaded);
    form.variants.push({ ...emptyVariant(), size: 'L', stock: '4' });

    expect(buildProductPayload(form).variants[1]).toEqual({ size: 'L', color: '', stock: 4 });
  });

  it('keeps an original_stock of zero', () => {
    const form = productToForm({ ...loaded, variants: [{ id: 3, size: 'M', color: '', stock: 0 }] });
    expect(buildProductPayload(form).variants[0].original_stock).toBe(0);
  });

  it('ends a sale with null', () => {
    expect(buildProductPayload(productToForm(loaded)).sale_price).toBeNull();
  });

  it('sends prices as numbers', () => {
    const payload = buildProductPayload({ ...valid, sale_price: '79.99' });
    expect(payload).toMatchObject({ cena: 100, sale_price: 79.99 });
  });
});

describe('validateProduct', () => {
  it('accepts a complete product', () => {
    expect(validateProduct(valid)).toEqual({});
  });

  it('lists empty required fields', () => {
    expect(Object.keys(validateProduct(emptyProduct()))).toEqual(expect.arrayContaining(['nazwa', 'kategoria', 'opis', 'cena']));
  });

  it.each(['100', '150'])('refuses a sale price of %s, not lower than the price', (price) => {
    expect(validateProduct({ ...valid, sale_price: price }).sale_price).toBeTruthy();
  });

  it('accepts a lower sale price', () => {
    expect(validateProduct({ ...valid, sale_price: '99.99' })).toEqual({});
  });

  it('needs one variant', () => {
    expect(validateProduct({ ...valid, variants: [] }).variants).toBeTruthy();
  });

  it.each(['-1', '1.5', '', 'x'])('refuses a stock of "%s"', (stock) => {
    expect(validateProduct({ ...valid, variants: [{ ...emptyVariant(), stock }] })['variants.0.stock']).toBeTruthy();
  });

  it('refuses a repeated variant, ignoring case', () => {
    const variants = [
      { ...emptyVariant(), size: 'M', color: 'Czarny' },
      { ...emptyVariant(), size: 'm', color: 'czarny ' },
    ];

    expect(validateProduct({ ...valid, variants })['variants.1.size']).toBeTruthy();
  });
});

describe('emptyVariant', () => {
  it('gives each row its own key', () => {
    expect(emptyVariant().key).not.toBe(emptyVariant().key);
  });
});
