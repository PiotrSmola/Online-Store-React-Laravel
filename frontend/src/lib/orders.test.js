import { describe, expect, it } from 'vitest';
import { canCancelOrder, canPayOrder, hasInvoice, toOrder } from './orders';

const order = {
  id: 1,
  subtotal_amount: '319.98',
  discount_amount: '32.00',
  delivery_price: '12.99',
  total_amount: '300.97',
  status: 'pending',
  payment_status: 'unpaid',
  payment_method: 'card',
  invoice_number: null,
  items: [{ id: 1, quantity: 2, price: '159.99', product_name: 'Spódnica', product: { nazwa: 'Nowa nazwa' } }],
  status_events: [{ id: 1, status: 'pending' }],
};

describe('toOrder', () => {
  it('turns stored amounts into numbers', () => {
    expect(toOrder(order)).toMatchObject({ subtotal: 319.98, discount: 32, deliveryPrice: 12.99, total: 300.97 });
  });

  it('uses the name at purchase, not the product today', () => {
    expect(toOrder(order).items[0]).toMatchObject({ name: 'Spódnica', unitPrice: 159.99, lineTotal: 319.98 });
  });

  it('exposes the status history', () => {
    expect(toOrder(order).statusEvents).toHaveLength(1);
  });

  it('copes with a light order', () => {
    expect(toOrder({ total_amount: '10.00' })).toMatchObject({ total: 10, discount: 0, items: [], statusEvents: [] });
  });
});

describe('canPayOrder', () => {
  it('allows an unpaid or declined card order', () => {
    expect(canPayOrder(order)).toBe(true);
    expect(canPayOrder({ ...order, payment_status: 'failed' })).toBe(true);
  });

  it.each([
    ['a paid order', { payment_status: 'paid' }],
    ['a transfer order', { payment_method: 'transfer' }],
    ['a cancelled order', { status: 'cancelled' }],
  ])('refuses %s', (_, change) => {
    expect(canPayOrder({ ...order, ...change })).toBe(false);
  });
});

describe('canCancelOrder', () => {
  it('allows only a pending order', () => {
    expect(canCancelOrder(order)).toBe(true);
    expect(canCancelOrder({ ...order, status: 'processing' })).toBe(false);
  });
});

describe('hasInvoice', () => {
  it('offers an invoice for a paid order', () => {
    expect(hasInvoice({ ...order, payment_status: 'paid' })).toBe(true);
  });

  it('keeps an invoice already issued for a refunded order', () => {
    expect(hasInvoice({ ...order, payment_status: 'refunded', invoice_number: 'FV/1' })).toBe(true);
  });

  it('offers none for an unpaid order', () => {
    expect(hasInvoice(order)).toBe(false);
  });
});
