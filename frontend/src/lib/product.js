import { API_URL } from '../config';

const PRODUCTS_PATH = `${API_URL}/storage/products`;

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
