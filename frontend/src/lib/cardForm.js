import { passesLuhn } from './luhn';

export const EMPTY_CARD = { number: '', name: '', expiry: '', cvv: '' };

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

/** Errors as { field: message }. An empty object means the card can be submitted. */
export function validateCard(card, now = new Date()) {
  const errors = {
    number: cardNumberError(card.number),
    name: card.name.trim() === '' ? 'Wpisz imię i nazwisko z karty' : null,
    expiry: expiryError(card.expiry, now),
    cvv: /^\d{3,4}$/.test(card.cvv) ? null : 'CVV musi mieć 3 lub 4 cyfry',
  };

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** The only part of a card that is ever sent. */
export function cardLastFour(number) {
  return number.replace(/\s/g, '').slice(-4);
}
