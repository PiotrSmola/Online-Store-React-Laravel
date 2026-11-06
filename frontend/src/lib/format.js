const LOCALE = 'pl-PL';

const priceFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PLN' });
const ratingFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long' });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short' });

function toNumber(value) {
  return typeof value === 'string' ? Number.parseFloat(value) : value;
}

function formatWith(formatter, value) {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatter.format(date);
}

/** The API sends prices as "549.99" or 549.99. Anything else renders as an empty string. */
export function formatPrice(value) {
  const amount = toNumber(value);
  return Number.isFinite(amount) ? priceFormat.format(amount) : '';
}

export function formatRating(value) {
  const rating = toNumber(value);
  return Number.isFinite(rating) ? ratingFormat.format(rating) : '';
}

export function formatDate(value) {
  return formatWith(dateFormat, value);
}

export function formatDateTime(value) {
  return formatWith(dateTimeFormat, value);
}

/** Polish plural: 1 produkt, 2 produkty, 5 produktów, 22 produkty, 112 produktów. */
export function pluralize(count, one, few, many) {
  const absolute = Math.abs(count);
  if (absolute === 1) return one;

  const lastDigit = absolute % 10;
  const lastTwoDigits = absolute % 100;
  const isFew = lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14);
  return isFew ? few : many;
}

export function countProducts(count) {
  return `${count} ${pluralize(count, 'produkt', 'produkty', 'produktów')}`;
}
