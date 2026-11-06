// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCartQuote } from '../../hooks/useCartQuote';
import Cart from './Cart';

const { items } = vi.hoisted(() => ({ items: [{ product_id: 1, size: null, color: null, quantity: 1 }] }));

vi.mock('../../hooks/useCartQuote', () => ({ useCartQuote: vi.fn() }));
vi.mock('../../Context/useShop', () => ({
  useCartActions: () => ({ clear: vi.fn(), removeItem: vi.fn(), setQuantity: vi.fn() }),
  useCartItems: () => items,
}));
vi.mock('../../Context/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const NOTE = /bezpłatn/i;

function renderCart(state) {
  useCartQuote.mockReturnValue({ data: undefined, error: null, loading: false, reload: vi.fn(), ...state });
  render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('the free delivery note in the cart', () => {
  it('stays away while the quote loads', () => {
    renderCart({ loading: true });
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('stays away when the quote failed', () => {
    renderCart({ error: new Error('Nie udało się') });
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('says what is missing', () => {
    renderCart({ data: { lines: [], subtotal: 100, free_delivery_missing: 200 } });
    expect(screen.getByText('Do bezpłatnej dostawy brakuje 200,00 zł.')).toBeTruthy();
  });

  it('confirms free delivery', () => {
    renderCart({ data: { lines: [], subtotal: 400, free_delivery_missing: 0 } });
    expect(screen.getByText('Masz bezpłatną dostawę.')).toBeTruthy();
  });
});
