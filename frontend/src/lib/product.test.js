import { describe, expect, it } from 'vitest';
import {
  cleanOptions,
  colorOptions,
  findVariant,
  firstBuyableVariant,
  imageUrl,
  optionsText,
  productHasOptions,
  sizeOptions,
  stockText,
} from './product';

const variants = [
  { id: 1, size: 'S', color: 'Czarny', stock: 0 },
  { id: 2, size: 'S', color: 'Biały', stock: 3 },
  { id: 3, size: 'M', color: 'Czarny', stock: 8 },
];

describe('findVariant', () => {
  it('finds a size and color pair', () => {
    expect(findVariant(variants, 'M', 'Czarny').id).toBe(3);
  });

  it('returns null for a combination that does not exist', () => {
    expect(findVariant(variants, 'M', 'Biały')).toBeNull();
  });

  it('matches a product without options, stored with blank or null values', () => {
    expect(findVariant([{ id: 9, size: '', color: null, stock: 1 }], null, null).id).toBe(9);
  });
});

describe('firstBuyableVariant', () => {
  it('skips sold out variants', () => {
    expect(firstBuyableVariant(variants).id).toBe(2);
  });

  it('falls back to the first variant when everything is sold out', () => {
    expect(firstBuyableVariant([variants[0]]).id).toBe(1);
  });

  it('copes with no variants', () => {
    expect(firstBuyableVariant([])).toBeNull();
  });
});

describe('sizeOptions', () => {
  it('disables a size that is sold out in the chosen color', () => {
    expect(sizeOptions(variants, ['S', 'M'], 'Czarny')).toEqual([
      { value: 'S', label: 'S (brak)', disabled: true },
      { value: 'M', label: 'M', disabled: false },
    ]);
  });

  it('disables a size with no variant in the chosen color', () => {
    expect(sizeOptions(variants, ['M'], 'Biały')[0].disabled).toBe(true);
  });

  it('looks at any color when none is chosen', () => {
    expect(sizeOptions(variants, ['S'], null)[0].disabled).toBe(false);
  });
});

describe('colorOptions', () => {
  it('disables a color that is sold out in the chosen size', () => {
    expect(colorOptions(variants, ['Czarny', 'Biały'], 'S')).toEqual([
      { value: 'Czarny', label: 'Czarny (brak)', disabled: true },
      { value: 'Biały', label: 'Biały', disabled: false },
    ]);
  });
});

describe('stockText', () => {
  it.each([
    [0, 'Wyprzedane'],
    [2, 'Ostatnie sztuki: 2'],
    [5, 'Dostępne: 5 szt.'],
  ])('describes a stock of %i', (stock, text) => {
    expect(stockText(stock)).toBe(text);
  });
});

describe('cleanOptions', () => {
  it('drops blanks and accepts a missing list', () => {
    expect(cleanOptions([' S ', '', null])).toEqual(['S']);
    expect(cleanOptions(null)).toEqual([]);
  });
});

describe('productHasOptions', () => {
  it('sees through blank options', () => {
    expect(productHasOptions({ rozmiar: [''], kolor: null })).toBe(false);
    expect(productHasOptions({ rozmiar: [], kolor: ['Czarny'] })).toBe(true);
  });
});

describe('imageUrl', () => {
  it('escapes the stored file name', () => {
    expect(imageUrl({ image_path: 'a b.jpg' })).toMatch(/\/products\/a%20b\.jpg$/);
  });

  it('points a thumbnail at the thumbs folder', () => {
    expect(imageUrl({ image_path: 'a.jpg' }, { thumbnail: true })).toMatch(/\/products\/thumbs\/a\.jpg$/);
  });

  it('uses the default photo for a product without images', () => {
    expect(imageUrl(null)).toMatch(/default-product\.jpg$/);
  });
});

describe('optionsText', () => {
  it('joins size and color', () => {
    expect(optionsText('M', 'Czarny')).toBe('Rozmiar M, kolor Czarny');
  });

  it('starts with a capital when only the color is set', () => {
    expect(optionsText(null, 'Czarny')).toBe('Kolor Czarny');
  });
});
