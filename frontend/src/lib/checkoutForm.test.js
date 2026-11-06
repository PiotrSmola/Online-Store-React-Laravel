import { describe, expect, it } from 'vitest';
import { buildOrderPayload, initialCheckoutForm, validateCheckout, validateField } from './checkoutForm';

const validForm = {
  ...initialCheckoutForm(null),
  email: 'jan@example.com',
  password: 'sekret123',
  first_name: 'Jan',
  last_name: 'Kowalski',
  phone: '500600700',
  address: 'Lipowa 1',
  city: 'Warszawa',
  postal_code: '00-001',
};

const shipping = {
  first_name: 'Ewa',
  last_name: 'Nowak',
  company_name: '',
  address: 'Długa 2',
  city: 'Gdańsk',
  postal_code: '80-001',
  country: 'Polska',
};

describe('initialCheckoutForm', () => {
  it('holds no card fields at all', () => {
    const form = JSON.stringify(initialCheckoutForm(null));
    expect(form).not.toMatch(/card_|cvv|expiry/);
  });

  it('fills in a signed-in customer', () => {
    const form = initialCheckoutForm({ email: 'a@b.pl', first_name: 'Ola', customer_type: 'company' });
    expect(form).toMatchObject({ email: 'a@b.pl', first_name: 'Ola', customer_type: 'company', country: 'Polska' });
  });
});

describe('validateCheckout', () => {
  it('accepts a complete form', () => {
    expect(validateCheckout(validForm, { isGuest: true })).toEqual({});
  });

  it('lists every empty required field', () => {
    const errors = validateCheckout(initialCheckoutForm(null), { isGuest: true });

    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['email', 'password', 'first_name', 'last_name', 'phone', 'address', 'city', 'postal_code']),
    );
  });

  it('asks a signed-in customer for no password', () => {
    expect(validateCheckout({ ...validForm, password: '' }, { isGuest: false }).password).toBeUndefined();
  });

  it('needs at least 8 password characters for a guest', () => {
    expect(validateCheckout({ ...validForm, password: 'krotkie' }, { isGuest: true }).password).toMatch(/8/);
  });

  it('rejects an email without a domain', () => {
    expect(validateCheckout({ ...validForm, email: 'jan@example' }, { isGuest: true }).email).toBeTruthy();
  });

  it('requires company data only from companies', () => {
    expect(validateCheckout(validForm, { isGuest: true }).nip).toBeUndefined();

    const company = { ...validForm, customer_type: 'company' };
    expect(Object.keys(validateCheckout(company, { isGuest: true }))).toEqual(['company_name', 'nip']);
  });

  it('requires a locker for locker delivery only', () => {
    expect(validateCheckout(validForm, { isGuest: true }).pickup_point).toBeUndefined();

    const locker = { ...validForm, delivery_method: 'pickup_point' };
    expect(validateCheckout(locker, { isGuest: true }).pickup_point).toBeTruthy();
    expect(validateCheckout({ ...locker, pickup_point: 'WAW01M' }, { isGuest: true })).toEqual({});
  });

  it('checks the delivery address only when it is separate', () => {
    const separate = { ...validForm, separate_shipping: true };
    expect(Object.keys(validateCheckout(separate, { isGuest: true }))).toEqual(
      expect.arrayContaining(['shipping.first_name', 'shipping.address', 'shipping.city']),
    );
    expect(validateCheckout({ ...separate, shipping }, { isGuest: true })).toEqual({});
  });

  it('does not need the optional shipping company', () => {
    const errors = validateCheckout({ ...validForm, separate_shipping: true }, { isGuest: true });
    expect(errors['shipping.company_name']).toBeUndefined();
  });
});

describe('validateField', () => {
  it('checks one field by its name', () => {
    expect(validateField('email', { ...validForm, email: 'jan' }, { isGuest: true })).toBeTruthy();
    expect(validateField('email', validForm, { isGuest: true })).toBeNull();
  });

  it('knows nested shipping fields', () => {
    expect(validateField('shipping.city', { ...validForm, separate_shipping: true }, { isGuest: true })).toBeTruthy();
  });

  it('returns null for an unknown field', () => {
    expect(validateField('coupon_code', validForm, { isGuest: true })).toBeNull();
  });
});

describe('buildOrderPayload', () => {
  const items = [{ product_id: 1, size: 'M', color: null, quantity: 2 }];

  it('uses the field names of the orders endpoint, not those of the cart', () => {
    const payload = buildOrderPayload(validForm, items, { isGuest: true });

    expect(payload.cart_items).toEqual([{ product_id: 1, quantity: 2, selected_size: 'M', selected_color: undefined }]);
  });

  it('sends the guest email and password', () => {
    expect(buildOrderPayload(validForm, items, { isGuest: true })).toMatchObject({ email: 'jan@example.com', password: 'sekret123' });
  });

  it('sends no email or password with a token', () => {
    const payload = buildOrderPayload(validForm, items, { isGuest: false });

    expect(payload.email).toBeUndefined();
    expect(payload.password).toBeUndefined();
  });

  it('never sends a price or a card field', () => {
    const payload = JSON.stringify(buildOrderPayload(validForm, items, { isGuest: true }));
    expect(payload).not.toMatch(/total|price|card_|cvv/);
  });

  it('sends a locker only for locker delivery', () => {
    const courier = { ...validForm, pickup_point: 'WAW01M' };
    expect(buildOrderPayload(courier, items, { isGuest: true }).pickup_point).toBeUndefined();

    const locker = { ...courier, delivery_method: 'pickup_point' };
    expect(buildOrderPayload(locker, items, { isGuest: true }).pickup_point).toBe('WAW01M');
  });

  it('sends a separate address only when chosen, without an empty company', () => {
    expect(buildOrderPayload({ ...validForm, shipping }, items, { isGuest: true }).shipping).toBeUndefined();

    const separate = buildOrderPayload({ ...validForm, separate_shipping: true, shipping }, items, { isGuest: true });
    expect(separate.shipping.city).toBe('Gdańsk');
    expect(separate.shipping.company_name).toBeUndefined();
  });

  it('sends company fields only for a company', () => {
    const individual = { ...validForm, company_name: 'Firma', nip: '123' };
    expect(buildOrderPayload(individual, items, { isGuest: true }).nip).toBeUndefined();

    const company = { ...individual, customer_type: 'company' };
    expect(buildOrderPayload(company, items, { isGuest: true }).nip).toBe('123');
  });
});
