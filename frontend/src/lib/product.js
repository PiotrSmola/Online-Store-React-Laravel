import { API_URL } from '../config';

const PRODUCTS_PATH = `${API_URL}/storage/products`;

export const THUMBNAIL_WIDTH = 640;
export const HERO_IMAGE_URL = `${API_URL}/storage/header-banner.jpg`;
export const DEFAULT_IMAGE_URL = `${PRODUCTS_PATH}/default-product.jpg`;

/** The photo's URL. Thumbnails are for list views; ProductImage falls back when one is missing. */
export function imageUrl(image, { thumbnail = false } = {}) {
  if (!image?.image_path) return DEFAULT_IMAGE_URL;
  const name = encodeURIComponent(image.image_path);
  return thumbnail ? `${PRODUCTS_PATH}/thumbs/${name}` : `${PRODUCTS_PATH}/${name}`;
}

/** Same rule as the backend: a stored option that is blank is not an option. */
export function cleanOptions(options) {
  return [].concat(options ?? []).map((option) => String(option ?? '').trim()).filter(Boolean);
}

export function productHasOptions(product) {
  return cleanOptions(product.rozmiar).length > 0 || cleanOptions(product.kolor).length > 0;
}

export function categoryPath(category) {
  return `/category/${encodeURIComponent(category)}`;
}

export function optionsText(size, color) {
  return [size && `Rozmiar ${size}`, color && `${size ? 'kolor' : 'Kolor'} ${color}`].filter(Boolean).join(', ');
}

function variantSize(variant) {
  return variant.size ?? '';
}

function variantColor(variant) {
  return variant.color ?? '';
}

function isBuyable(variant) {
  return variant.stock > 0;
}

/** The variant for this choice, or null. A product without an option has a blank value there. */
export function findVariant(variants, size, color) {
  return variants.find((variant) => variantSize(variant) === (size ?? '') && variantColor(variant) === (color ?? '')) ?? null;
}

/** The first choice that can be bought, so the page never opens on a sold out combination. */
export function firstBuyableVariant(variants) {
  return variants.find(isBuyable) ?? variants[0] ?? null;
}

/** Size options with sold out combinations disabled, given the chosen color. */
export function sizeOptions(variants, sizes, color) {
  return sizes.map((size) => {
    const buyable = variants.some((variant) => variantSize(variant) === size && (!color || variantColor(variant) === color) && isBuyable(variant));
    return { value: size, label: buyable ? size : `${size} (brak)`, disabled: !buyable };
  });
}

/** Color options with sold out combinations disabled, given the chosen size. */
export function colorOptions(variants, colors, size) {
  return colors.map((color) => {
    const buyable = variants.some((variant) => variantColor(variant) === color && (!size || variantSize(variant) === size) && isBuyable(variant));
    return { value: color, label: buyable ? color : `${color} (brak)`, disabled: !buyable };
  });
}

/** Short stock text for a chosen variant. Stock under 5 is worth pointing out. */
export function stockText(stock) {
  if (stock <= 0) return 'Wyprzedane';
  return stock < 5 ? `Ostatnie sztuki: ${stock}` : `Dostępne: ${stock} szt.`;
}
