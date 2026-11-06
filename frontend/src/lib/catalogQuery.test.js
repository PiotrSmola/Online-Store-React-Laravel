import { describe, expect, it } from 'vitest';
import { catalogPageHref, hasActiveFilters, nextCatalogSearch, readCatalogQuery } from './catalogQuery';

const read = (search) => readCatalogQuery(new URLSearchParams(search));

describe('readCatalogQuery', () => {
  it('reads every field', () => {
    expect(read('q=buty&sort=price_asc&min_price=10&max_price=99.5&size=M&color=Czarny&page=3')).toEqual({
      q: 'buty',
      sort: 'price_asc',
      min_price: '10',
      max_price: '99.5',
      size: 'M',
      color: 'Czarny',
      page: 3,
    });
  });

  it('gives defaults for an empty URL', () => {
    expect(read('')).toEqual({ q: '', sort: '', min_price: '', max_price: '', size: '', color: '', page: 1 });
  });

  it('drops an unknown sort, which the API would refuse', () => {
    expect(read('sort=hacked').sort).toBe('');
  });

  it.each(['abc', '-5'])('drops the price %s', (price) => {
    expect(read(`min_price=${price}`).min_price).toBe('');
  });

  it.each(['0', '-1', 'x', '1.5'])('falls back to the first page for %s', (page) => {
    expect(read(`page=${page}`).page).toBe(1);
  });

  it('stops the search text at 100 characters', () => {
    expect(read(`q=${'a'.repeat(150)}`).q).toHaveLength(100);
  });
});

describe('hasActiveFilters', () => {
  it('ignores the sort and the page', () => {
    expect(hasActiveFilters(read('sort=name&page=2'))).toBe(false);
  });

  it.each(['q=a', 'size=M', 'color=Czarny', 'min_price=1', 'max_price=2'])('sees %s', (search) => {
    expect(hasActiveFilters(read(search))).toBe(true);
  });
});

describe('nextCatalogSearch', () => {
  it('returns to the first page when a filter changes', () => {
    expect(nextCatalogSearch(read('size=M&page=4'), { color: 'Czarny' }).toString()).toBe('size=M&color=Czarny');
  });

  it('keeps the filters when the page changes', () => {
    expect(nextCatalogSearch(read('size=M'), { page: 2 }).toString()).toBe('size=M&page=2');
  });

  it('leaves out empty values', () => {
    expect(nextCatalogSearch(read('size=M&color=Czarny'), { size: '' }).toString()).toBe('color=Czarny');
  });

  it('accepts a query with no page', () => {
    expect(nextCatalogSearch({}, { q: 'buty' }).toString()).toBe('q=buty');
  });
});

describe('catalogPageHref', () => {
  it('keeps the path and filters', () => {
    expect(catalogPageHref('/sale', read('size=M'), 3)).toBe('/sale?size=M&page=3');
  });

  it('writes the first page without a page field', () => {
    expect(catalogPageHref('/products', read('page=5'), 1)).toBe('/products');
  });
});
