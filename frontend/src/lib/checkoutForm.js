const MIN_PASSWORD_LENGTH = 8;

export const CASH = 'cash';
export const CARD = 'card';
export const STORE_PICKUP = 'store_pickup';
export const PICKUP_POINT = 'pickup_point';

const EMPTY_SHIPPING = {
  first_name: '',
  last_name: '',
  company_name: '',
  address: '',
  city: '',
  postal_code: '',
  country: 'Polska',
};

export const PAYMENT_METHODS = [
  { value: CARD, label: 'Płatność kartą' },
  { value: 'transfer', label: 'Przelew bankowy' },
  { value: CASH, label: 'Płatność w sklepie' },
];

export function initialCheckoutForm(customer) {
  return {
    customer_type: customer?.customer_type || 'individual',
    email: customer?.email || '',
    password: '',
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    phone: customer?.phone || '',
    company_name: customer?.company_name || '',
    nip: customer?.nip || '',
    address: customer?.address || '',
    city: customer?.city || '',
    postal_code: customer?.postal_code || '',
    country: customer?.country || 'Polska',
    payment_method: CARD,
    delivery_method: 'courier',
    pickup_point: '',
    separate_shipping: false,
    shipping: EMPTY_SHIPPING,
    coupon_code: '',
  };
}

function required(value, message) {
  return String(value ?? '').trim() === '' ? message : null;
}

function emailError(value) {
  const missing = required(value, 'Wpisz adres e-mail');
  if (missing) return missing;
  return /^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Adres e-mail jest niepełny. Wpisz go w formacie nazwa@domena.pl';
}

function passwordError(value) {
  if (!value) return 'Wpisz hasło do konta';
  return value.length < MIN_PASSWORD_LENGTH ? `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków` : null;
}

function shippingRules(form) {
  if (!form.separate_shipping) return {};

  const { shipping } = form;

  return {
    'shipping.first_name': () => required(shipping.first_name, 'Wpisz imię odbiorcy'),
    'shipping.last_name': () => required(shipping.last_name, 'Wpisz nazwisko odbiorcy'),
    'shipping.address': () => required(shipping.address, 'Wpisz ulicę i numer dostawy'),
    'shipping.postal_code': () => required(shipping.postal_code, 'Wpisz kod pocztowy dostawy'),
    'shipping.city': () => required(shipping.city, 'Wpisz miasto dostawy'),
    'shipping.country': () => required(shipping.country, 'Wpisz kraj dostawy'),
  };
}

function fieldRules(form, { isGuest }) {
  const isCompany = form.customer_type === 'company';

  return {
    email: () => emailError(form.email),
    password: () => (isGuest ? passwordError(form.password) : null),
    first_name: () => required(form.first_name, 'Wpisz imię'),
    last_name: () => required(form.last_name, 'Wpisz nazwisko'),
    phone: () => required(form.phone, 'Wpisz numer telefonu'),
    company_name: () => (isCompany ? required(form.company_name, 'Wpisz nazwę firmy') : null),
    nip: () => (isCompany ? required(form.nip, 'Wpisz NIP') : null),
    address: () => required(form.address, 'Wpisz ulicę i numer'),
    city: () => required(form.city, 'Wpisz miasto'),
    postal_code: () => required(form.postal_code, 'Wpisz kod pocztowy'),
    country: () => required(form.country, 'Wpisz kraj'),
    pickup_point: () => (form.delivery_method === PICKUP_POINT ? required(form.pickup_point, 'Wybierz paczkomat') : null),
    ...shippingRules(form),
  };
}

/** The error of one field, or null. Used when a field loses focus. */
export function validateField(name, form, { isGuest }) {
  return fieldRules(form, { isGuest })[name]?.() ?? null;
}

/** Errors of the whole form as { field: message }. An empty object means the form is valid. */
export function validateCheckout(form, { isGuest }) {
  const errors = {};

  Object.entries(fieldRules(form, { isGuest })).forEach(([name, rule]) => {
    const message = rule();
    if (message) errors[name] = message;
  });

  return errors;
}

function trimmedShipping({ company_name: companyName, ...shipping }) {
  return { ...shipping, company_name: companyName || undefined };
}

/** The body of POST /orders. The server works out all prices, so none are sent. */
export function buildOrderPayload(form, items, { isGuest }) {
  const isCompany = form.customer_type === 'company';

  return {
    customer_type: form.customer_type,
    email: isGuest ? form.email : undefined,
    password: isGuest ? form.password : undefined,
    first_name: form.first_name,
    last_name: form.last_name,
    phone: form.phone,
    address: form.address,
    city: form.city,
    postal_code: form.postal_code,
    country: form.country,
    company_name: isCompany ? form.company_name : undefined,
    nip: isCompany ? form.nip : undefined,
    delivery_method: form.delivery_method,
    pickup_point: form.delivery_method === PICKUP_POINT ? form.pickup_point : undefined,
    payment_method: form.payment_method,
    shipping: form.separate_shipping ? trimmedShipping(form.shipping) : undefined,
    coupon_code: form.coupon_code || undefined,
    cart_items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_size: item.size ?? undefined,
      selected_color: item.color ?? undefined,
    })),
  };
}
