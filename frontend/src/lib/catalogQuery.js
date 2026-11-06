export const SORT_OPTIONS = [
  { value: 'newest', label: 'Od najnowszych' },
  { value: 'price_asc', label: 'Cena rosnąco' },
  { value: 'price_desc', label: 'Cena malejąco' },
  { value: 'name', label: 'Nazwa' },
  { value: 'rating', label: 'Najlepiej oceniane' },
];

export const PER_PAGE = 24;

const SORTS = new Set(SORT_OPTIONS.map((option) => option.value));
const FILTER_KEYS = ['q', 'sort', 'min_price', 'max_price', 'size', 'color'];

/** Digits with up to two decimals. Rejects a lone dot and 1.5.5, which the API answers with a 422. */
export function isValidPrice(value) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

function priceValue(value) {
  return value !== null && isValidPrice(value.trim()) ? value.trim() : '';
}

function pageValue(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/**
 * Reads the shareable state of a catalog page from its URL. A hand-edited value is dropped here
 * rather than sent on, because the API answers an unknown sort or a bad price with a 422.
 */
export function readCatalogQuery(searchParams) {
  const sort = searchParams.get('sort');

  return {
    q: (searchParams.get('q') ?? '').slice(0, 100),
    sort: SORTS.has(sort) ? sort : '',
    min_price: priceValue(searchParams.get('min_price')),
    max_price: priceValue(searchParams.get('max_price')),
    size: searchParams.get('size') ?? '',
    color: searchParams.get('color') ?? '',
    page: pageValue(searchParams.get('page')),
  };
}

export function hasActiveFilters(query) {
  return FILTER_KEYS.some((key) => key !== 'sort' && query[key]);
}

/** The next URL query. Changing anything but the page returns to the first page. */
export function nextCatalogSearch(query, changes) {
  const next = { ...query, page: 'page' in changes ? changes.page : 1, ...changes };
  const params = new URLSearchParams();

  FILTER_KEYS.forEach((key) => {
    if (next[key]) params.set(key, next[key]);
  });
  if (next.page > 1) params.set('page', next.page);

  return params;
}

/** The URL of one page of the current results, for pagination links. */
export function catalogPageHref(pathname, query, page) {
  const search = nextCatalogSearch(query, { page }).toString();
  return search ? `${pathname}?${search}` : pathname;
}
