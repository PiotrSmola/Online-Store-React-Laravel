import { describe, expect, it } from 'vitest';
import {
  buildOrderPayload,
  formatCardNumber,
  formatExpiry,
  initialCheckoutForm,
  validateCheckout,
  validateField,
} from './checkoutForm';

const now = new Date(2026, 10, 6);

const validForm = {
  ...initialCheckoutForm(null),
  email: 'jan@example.com',
  password: 'sekret1',
  first_name: 'Jan',
  last_name: 'Kowalski',
  phone: '500600700',
  address: 'Lipowa 1',
  city: 'Warszawa',
  postal_code: '00-001',
  payment: { card_number: '4111 1111 1111 1111', card_name: 'Jan Kowalski', expiry_date: '12/28', cvv: '123' },
};

describe('card input formatting', () => {
  it('groups the number in fours and drops other characters', () => {
    expect(formatCardNumber('4111-1111x1111 1111')).toBe('4111 1111 1111 1111');
  });

  it('allows 19 digits at most', () => {
    expect(formatCardNumber('1'.repeat(25)).replace(/\s/g, '')).toHaveLength(19);
  });

  it('adds the slash to the expiry date', () => {
    expect(formatExpiry('12')).toBe('12');
    expect(formatExpiry('1228')).toBe('12/28');
    expect(formatExpiry('12/289')).toBe('12/28');
  });
});

describe('validateCheckout', () => {
  it('accepts a complete form', () => {
    expect(validateCheckout(validForm, { isGuest: true, now })).toEqual({});
  });

  it('lists every empty required field', () => {
    const errors = validateCheckout(initialCheckoutForm(null), { isGuest: true, now });

    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['email', 'password', 'first_name', 'phone', 'address', 'payment.card_number']),
    );
  });

  it('asks a signed-in customer for no password', () => {
    expect(validateCheckout({ ...validForm, password: '' }, { isGuest: false, now }).password).toBeUndefined();
  });

  it('requires company data only from companies', () => {
    expect(validateCheckout(validForm, { isGuest: true, now }).nip).toBeUndefined();

    const company = { ...validForm, customer_type: 'company' };
    expect(Object.keys(validateCheckout(company, { isGuest: true, now }))).toEqual(['company_name', 'nip']);
  });

  it('skips card fields for other payment methods', () => {
    const transfer = { ...validForm, payment_method: 'transfer', payment: initialCheckoutForm(null).payment };
    expect(validateCheckout(transfer, { isGuest: true, now })).toEqual({});
  });

  it.each(['4111 1111 1111 1112', '4111'])('rejects the card number %s', (cardNumber) => {
    const form = { ...validForm, payment: { ...validForm.payment, card_number: cardNumber } };
    expect(validateCheckout(form, { isGuest: true, now })['payment.card_number']).toBeTruthy();
  });

  it.each(['13/28', '00/28', '1/28', '10/26', '12/25'])('rejects the expiry date %s', (expiry) => {
    const form = { ...validForm, payment: { ...validForm.payment, expiry_date: expiry } };
    expect(validateCheckout(form, { isGuest: true, now })['payment.expiry_date']).toBeTruthy();
  });

  it('accepts a card expiring this month', () => {
    const form = { ...validForm, payment: { ...validForm.payment, expiry_date: '11/26' } };
    expect(validateCheckout(form, { isGuest: true, now })).toEqual({});
  });
});

describe('validateField', () => {
  it('checks one field by its name', () => {
    expect(validateField('email', { ...validForm, email: 'jan' }, { isGuest: true, now })).toBeTruthy();
    expect(validateField('email', validForm, { isGuest: true, now })).toBeNull();
  });
});

describe('buildOrderPayload', () => {
  const items = [{ product_id: 1, size: 'M', color: null, quantity: 2 }];

  it('uses the field names of the orders endpoint', () => {
    const payload = buildOrderPayload(validForm, items, { isGuest: true });

    expect(payload.cart_items).toEqual([{ product_id: 1, quantity: 2, selected_size: 'M', selected_color: null }]);
    expect(payload.password).toBe('sekret1');
  });

  it('never sends typed card data with another payment method', () => {
    const payload = buildOrderPayload({ ...validForm, payment_method: 'transfer' }, items, { isGuest: true });

    expect(payload.payment.card_number).toBe('');
    expect(payload.payment.cvv).toBe('');
  });

  it('sends no password for a signed-in customer', () => {
    expect(buildOrderPayload(validForm, items, { isGuest: false }).password).toBeNull();
  });
});
