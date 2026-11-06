// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartQuote } from '../../hooks/useCartQuote';
import { ApiError } from '../../lib/api';
import { placeOrder } from '../../lib/orders';
import { verifySession } from '../../lib/session';
import CheckoutForm from './CheckoutForm';

const { navigate, clear, signInWith, items } = vi.hoisted(() => ({
  navigate: vi.fn(),
  clear: vi.fn(),
  signInWith: vi.fn(),
  items: [{ product_id: 1, size: null, color: null, quantity: 1 }],
}));

vi.mock('../../hooks/useCartQuote', () => ({ useCartQuote: vi.fn() }));
vi.mock('../../lib/orders', () => ({ placeOrder: vi.fn() }));
vi.mock('../../lib/session', () => ({ verifySession: vi.fn() }));
vi.mock('../../Context/useShop', () => ({
  useAuth: () => ({ signInWith }),
  useCartActions: () => ({ clear }),
  useCartItems: () => items,
}));
vi.mock('../../Context/useShopData', () => ({
  useShopData: () => ({ config: { data: { pickup_points: [] } } }),
}));
vi.mock('react-router', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigate }));

const customer = {
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Nowak',
  phone: '500600700',
  address: 'Lipowa 1',
  postal_code: '00-001',
  city: 'Warszawa',
  country: 'Polska',
};

const quote = {
  lines: [{ key: '1::', available: true, line_total: 100, product: { nazwa: 'Kurtka', images: [] } }],
  subtotal: 100,
  discount: 0,
  coupon: null,
  coupon_error: null,
  delivery_price: 15,
  delivery_options: [
    { value: 'courier', label: 'Kurier', price: 15 },
    { value: 'store_pickup', label: 'Odbiór w sklepie', price: 0 },
  ],
  free_delivery_missing: 200,
  total: 115,
};

const placed = { order: { id: 9 }, token: null, customer: null };
const onPlaced = vi.fn();

function showQuote(changes = {}, data = {}) {
  useCartQuote.mockReturnValue({
    data: { ...quote, ...data },
    error: null,
    loading: false,
    reload: vi.fn(),
    ...changes,
  });
}

function renderForm(props = {}) {
  render(
    <MemoryRouter>
      <CheckoutForm customer={customer} onPlaced={onPlaced} {...props} />
    </MemoryRouter>,
  );
}

const couponField = () => screen.getByLabelText('Kod (opcjonalnie)');
const typeCoupon = (value) => fireEvent.change(couponField(), { target: { value } });
const lastCoupon = () => useCartQuote.mock.lastCall[1].coupon;

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Złóż zamówienie' }));

beforeEach(() => {
  vi.clearAllMocks();
  showQuote();
  verifySession.mockResolvedValue({});
  placeOrder.mockResolvedValue(placed);
});

afterEach(cleanup);

describe('a placed order', () => {
  it('goes on to payment for a card', async () => {
    renderForm();
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/orders/9/pay', { replace: true }));
    expect(onPlaced).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it('goes to the success page for a transfer', async () => {
    renderForm();
    fireEvent.click(screen.getByLabelText('Przelew bankowy'));
    submit();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success', { state: { order: placed.order } }));
  });

  it('signs in a guest who got an account with the order', async () => {
    placeOrder.mockResolvedValue({ ...placed, token: 'new', customer });
    renderForm();
    submit();

    await waitFor(() => expect(signInWith).toHaveBeenCalledWith(customer, 'new'));
  });
});

describe('a refused order', () => {
  function expectNothingPlaced() {
    expect(clear).not.toHaveBeenCalled();
    expect(onPlaced).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  }

  it('shows the message of a 402 and keeps the cart', async () => {
    placeOrder.mockRejectedValue(new ApiError('Płatność została odrzucona.', { status: 402 }));
    renderForm();
    submit();

    expect(await screen.findByText('Płatność została odrzucona.')).toBeTruthy();
    expectNothingPlaced();
  });

  it('puts the errors of a 422 on their fields', async () => {
    placeOrder.mockRejectedValue(
      new ApiError('Popraw dane', { status: 422, errors: { phone: ['Numer telefonu jest za krótki'] } }),
    );
    renderForm();
    submit();

    const links = await screen.findAllByText('Numer telefonu jest za krótki');

    expect(links.some((element) => element.getAttribute('href') === '#checkout-phone')).toBe(true);
    expect(screen.getByLabelText('Telefon').getAttribute('aria-invalid')).toBe('true');
    expectNothingPlaced();
  });

  it('joins the messages of errors.cart into one line', async () => {
    placeOrder.mockRejectedValue(
      new ApiError('Popraw dane', { status: 422, errors: { cart: ['Kurtka: brak w magazynie.', 'Pasek: zostały 2.'] } }),
    );
    renderForm();
    submit();

    expect(await screen.findByText('Kurtka: brak w magazynie. Pasek: zostały 2.')).toBeTruthy();
    expectNothingPlaced();
  });

  it('keeps other field errors next to errors.cart', async () => {
    placeOrder.mockRejectedValue(
      new ApiError('Popraw dane', { status: 422, errors: { cart: ['Brak w magazynie.'], phone: ['Zły numer'] } }),
    );
    renderForm();
    submit();

    expect(await screen.findByText('Brak w magazynie.')).toBeTruthy();
    expect(screen.getByLabelText('Telefon').getAttribute('aria-invalid')).toBe('true');
  });

  it('places nothing when the session is gone, and leaves the redirect to the 401 handler', async () => {
    verifySession.mockRejectedValue(new ApiError('Nie zalogowano', { status: 401 }));
    renderForm();
    submit();

    await waitFor(() => expect(verifySession).toHaveBeenCalled());
    expect(placeOrder).not.toHaveBeenCalled();
    expect(screen.queryByText('Popraw dane w formularzu')).toBeNull();
  });

  it('skips the session check for a guest', async () => {
    renderForm({ customer: null });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'nowa@example.com' } });
    fireEvent.change(screen.getByLabelText('Hasło'), { target: { value: 'dlugiehaslo' } });
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: 'Ola' } });
    fireEvent.change(screen.getByLabelText('Nazwisko'), { target: { value: 'Kot' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '500600700' } });
    fireEvent.change(screen.getByLabelText('Ulica i numer'), { target: { value: 'Lipowa 1' } });
    fireEvent.change(screen.getByLabelText('Kod pocztowy'), { target: { value: '00-001' } });
    fireEvent.change(screen.getByLabelText('Miasto'), { target: { value: 'Warszawa' } });
    submit();

    await waitFor(() => expect(placeOrder).toHaveBeenCalledOnce());
    expect(verifySession).not.toHaveBeenCalled();
  });
});

describe('the quote behind the order', () => {
  const WAIT = 'Poczekaj na podsumowanie zamówienia albo spróbuj je wczytać ponownie.';

  it('blocks the order until there is a quote', async () => {
    showQuote({ data: undefined, loading: true });
    renderForm();
    submit();

    expect(await screen.findByText(WAIT)).toBeTruthy();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('blocks the order while a newer quote is on its way', async () => {
    showQuote({ loading: true });
    renderForm();
    submit();

    expect(await screen.findByText(WAIT)).toBeTruthy();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('blocks the order when a product is not available', async () => {
    showQuote({}, { lines: [{ ...quote.lines[0], available: false }] });
    renderForm();
    submit();

    expect(await screen.findByText('Popraw koszyk: niektóre produkty są niedostępne.')).toBeTruthy();
    expect(placeOrder).not.toHaveBeenCalled();
  });
});

describe('the coupon', () => {
  const sentCoupon = () => placeOrder.mock.calls[0][0].coupon_code;

  it('applies on Enter and does not place the order', () => {
    renderForm();
    typeCoupon(' witaj10 ');

    const notPrevented = fireEvent.keyDown(couponField(), { key: 'Enter' });

    expect(notPrevented).toBe(false);
    expect(lastCoupon()).toBe('witaj10');
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('leaves other keys alone', () => {
    renderForm();
    typeCoupon('WITAJ10');

    expect(fireEvent.keyDown(couponField(), { key: 'a' })).toBe(true);
    expect(lastCoupon()).toBe('');
  });

  it('applies from the button', () => {
    renderForm();
    typeCoupon('WITAJ10');
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj kod' }));

    expect(lastCoupon()).toBe('WITAJ10');
  });

  it('sends the code the server verified, not what was typed', async () => {
    showQuote({}, { coupon: { code: 'WITAJ10', label: 'Rabat 10%' } });
    renderForm();
    typeCoupon('witaj10');
    fireEvent.keyDown(couponField(), { key: 'Enter' });
    typeCoupon('INNY');
    submit();

    await waitFor(() => expect(placeOrder).toHaveBeenCalledOnce());
    expect(sentCoupon()).toBe('WITAJ10');
  });

  it('sends no code when the server refused it', async () => {
    showQuote({}, { coupon: null, coupon_error: 'Ten kod wygasł.' });
    renderForm();
    typeCoupon('STARY');
    fireEvent.keyDown(couponField(), { key: 'Enter' });
    submit();

    await waitFor(() => expect(placeOrder).toHaveBeenCalledOnce());
    expect(sentCoupon()).toBeUndefined();
  });
});

describe('the delivery note', () => {
  it('shows what is missing for free delivery', () => {
    renderForm();
    expect(screen.getByText(/Do bezpłatnej dostawy brakuje/)).toBeTruthy();
  });

  it('is hidden for store pickup, where nothing is delivered', () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/Odbiór w sklepie/));

    expect(screen.queryByText(/Do bezpłatnej dostawy brakuje/)).toBeNull();
  });
});
