let nextRowKey = 1;

function rowKey() {
  nextRowKey += 1;
  return `row-${nextRowKey}`;
}

export function emptyVariant() {
  return { key: rowKey(), size: '', color: '', stock: '0', original_stock: null };
}

export function emptyProduct() {
  return {
    nazwa: '',
    kategoria: '',
    cena: '',
    sale_price: '',
    opis: '',
    is_active: true,
    is_new: false,
    variants: [emptyVariant()],
  };
}

/** The form's state for a loaded product. original_stock remembers what the form was loaded with. */
export function productToForm(product) {
  return {
    nazwa: product.nazwa,
    kategoria: product.kategoria,
    cena: product.cena,
    sale_price: product.sale_price ?? '',
    opis: product.opis ?? '',
    is_active: product.is_active,
    is_new: product.is_new,
    variants: (product.variants ?? []).map((variant) => ({
      key: `variant-${variant.id}`,
      size: variant.size ?? '',
      color: variant.color ?? '',
      stock: String(variant.stock),
      original_stock: variant.stock,
    })),
  };
}

function variantKey(variant) {
  return `${variant.size.trim().toLowerCase()}|${variant.color.trim().toLowerCase()}`;
}

function isNumber(value) {
  return value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

/** Errors as { field: message }, with the API's names for variant rows. */
export function validateProduct(form) {
  const errors = {};

  if (!form.nazwa.trim()) errors.nazwa = 'Wpisz nazwę produktu';
  if (!form.kategoria.trim()) errors.kategoria = 'Wpisz kategorię';
  if (!form.opis.trim()) errors.opis = 'Wpisz opis';
  if (!isNumber(form.cena)) errors.cena = 'Wpisz cenę, na przykład 49.99';

  if (form.sale_price !== '') {
    if (!isNumber(form.sale_price)) errors.sale_price = 'Wpisz cenę promocyjną, na przykład 39.99';
    else if (Number(form.sale_price) >= Number(form.cena)) errors.sale_price = 'Cena promocyjna musi być niższa od ceny';
  }

  if (form.variants.length === 0) errors.variants = 'Dodaj co najmniej jeden wariant';

  const seen = new Set();

  form.variants.forEach((variant, index) => {
    if (!Number.isInteger(Number(variant.stock)) || variant.stock === '' || Number(variant.stock) < 0) {
      errors[`variants.${index}.stock`] = 'Wpisz stan jako liczbę całkowitą, 0 lub więcej';
    }

    const key = variantKey(variant);
    if (seen.has(key)) errors[`variants.${index}.size`] = 'Taki wariant już jest na liście';
    seen.add(key);
  });

  return errors;
}

/**
 * The request body. Stock is applied on the server as a difference, so a variant that already
 * exists sends the value the form loaded next to the new one, and orders placed meanwhile stay
 * counted. A new variant sends only its stock.
 */
export function buildProductPayload(form) {
  return {
    nazwa: form.nazwa.trim(),
    kategoria: form.kategoria.trim(),
    cena: Number(form.cena),
    sale_price: form.sale_price === '' ? null : Number(form.sale_price),
    opis: form.opis,
    is_active: form.is_active,
    is_new: form.is_new,
    variants: form.variants.map((variant) => ({
      size: variant.size.trim(),
      color: variant.color.trim(),
      stock: Number(variant.stock),
      ...(variant.original_stock === null ? {} : { original_stock: variant.original_stock }),
    })),
  };
}
