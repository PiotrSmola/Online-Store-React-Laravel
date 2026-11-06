import { passesLuhn } from './luhn';

const EMPTY_CARD = { card_number: '', card_name: '', expiry_date: '', cvv: '' };
const MIN_PASSWORD_LENGTH = 6;

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
    payment_method: 'card',
    delivery_method: 'courier',
    payment: EMPTY_CARD,
  };
}

/** "4111111111111111" becomes "4111 1111 1111 1111". Other characters are dropped. */
export function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1228" becomes "12/28". */
export function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
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

function cardNumberError(value) {
  const digits = value.replace(/\s/g, '');
  if (digits.length < 13 || digits.length > 19) return 'Numer karty musi mieć od 13 do 19 cyfr';
  return passesLuhn(digits) ? null : 'Numer karty jest nieprawidłowy. Sprawdź cyfry';
}

function expiryError(value, now) {
  if (!/^\d{2}\/\d{2}$/.test(value)) return 'Wpisz datę ważności w formacie MM/RR';

  const [month, year] = value.split('/').map(Number);
  if (month < 1 || month > 12) return 'Miesiąc musi mieć wartość od 01 do 12';

  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  const expired = year < currentYear || (year === currentYear && month < currentMonth);
  return expired ? 'Ta karta jest przeterminowana. Użyj innej karty' : null;
}

function cvvError(value) {
  return /^\d{3,4}$/.test(value) ? null : 'CVV musi mieć 3 lub 4 cyfry';
}

function fieldRules(form, { isGuest, now }) {
  const isCompany = form.customer_type === 'company';
  const isCard = form.payment_method === 'card';

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
    'payment.card_number': () => (isCard ? cardNumberError(form.payment.card_number) : null),
    'payment.card_name': () => (isCard ? required(form.payment.card_name, 'Wpisz imię i nazwisko z karty') : null),
    'payment.expiry_date': () => (isCard ? expiryError(form.payment.expiry_date, now) : null),
    'payment.cvv': () => (isCard ? cvvError(form.payment.cvv) : null),
  };
}

/** The error of one field, or null. Used when a field loses focus. */
export function validateField(name, form, { isGuest, now = new Date() }) {
  return fieldRules(form, { isGuest, now })[name]?.() ?? null;
}

/** Errors of the whole form as { field: message }. An empty object means the form is valid. */
export function validateCheckout(form, { isGuest, now = new Date() }) {
  const errors = {};

  Object.entries(fieldRules(form, { isGuest, now })).forEach(([name, rule]) => {
    const message = rule();
    if (message) errors[name] = message;
  });

  return errors;
}

/** Card fields only leave the browser when paying by card. The server works out all prices. */
export function buildOrderPayload(form, items, { isGuest }) {
  const isCompany = form.customer_type === 'company';

  return {
    ...form,
    password: isGuest ? form.password : null,
    company_name: isCompany ? form.company_name : null,
    nip: isCompany ? form.nip : null,
    payment: form.payment_method === 'card' ? form.payment : EMPTY_CARD,
    cart_items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_size: item.size,
      selected_color: item.color,
    })),
  };
}
