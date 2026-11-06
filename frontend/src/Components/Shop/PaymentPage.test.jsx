// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentPage from './PaymentPage';

const order = {
  id: 5,
  order_number: 'ZAM-5',
  status: 'pending',
  payment_method: 'card',
  payment_status: 'pending',
  payment_status_label: 'Oczekuje',
  total_amount: '100.00',
  items: [],
};

const GOOD_CARD = '4242 4242 4242 4242';
const REFUSED = { status: 402, body: { message: 'Płatność została odrzucona.' } };
const PAID = { status: 200, body: { ...order, status: 'paid', payment_status: 'paid' } };

const respond = ({ status, body }) => new Response(JSON.stringify(body), { status });

function stubApi(order_, ...payResults) {
  const results = [...payResults];

  const mock = vi.fn(async (url, options) => {
    if (options?.method === 'POST') return respond(results.shift());
    return respond({ status: 200, body: order_ });
  });

  vi.stubGlobal('fetch', mock);
  return mock;
}

const payments = (mock) => mock.mock.calls.filter(([, options]) => options?.method === 'POST');

function Success() {
  const { state } = useLocation();
  return <p>Opłacono {state.order.order_number}</p>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/orders/5/pay']}>
      <Routes>
        <Route path="/orders/:id/pay" element={<PaymentPage />} />
        <Route path="/order-success" element={<Success />} />
      </Routes>
    </MemoryRouter>,
  );
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillCard(number = GOOD_CARD) {
  type('Numer karty', number);
  type('Imię i nazwisko z karty', 'Anna Nowak');
  type('Data ważności', '12/40');
  type('CVV', '123');
}

const pay = async () => fireEvent.click(await screen.findByRole('button', { name: /Zapłać/ }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PaymentPage', () => {
  it('sends only the last four digits', async () => {
    const mock = stubApi(order, PAID);
    renderPage();
    await screen.findByRole('button', { name: /Zapłać/ });

    fillCard();
    await pay();
    await screen.findByText('Opłacono ZAM-5');

    const [[url, options]] = payments(mock);
    expect(url).toMatch(/\/api\/orders\/5\/pay$/);
    expect(options.body).toBe('{"card_last_four":"4242"}');
  });

  it('sends nothing for a number that fails the checksum', async () => {
    const mock = stubApi(order);
    renderPage();
    await screen.findByRole('button', { name: /Zapłać/ });

    fillCard('4242 4242 4242 4241');
    await pay();

    expect(await screen.findAllByText(/Numer karty jest nieprawidłowy/)).not.toHaveLength(0);
    expect(payments(mock)).toHaveLength(0);
  });

  it('shows a refused card, clears the fields and allows another try', async () => {
    const mock = stubApi(order, REFUSED, PAID);
    renderPage();
    await screen.findByRole('button', { name: /Zapłać/ });

    fillCard();
    await pay();

    expect(await screen.findByText('Płatność się nie powiodła')).toBeTruthy();
    expect(screen.getByText('Płatność została odrzucona.')).toBeTruthy();

    ['Numer karty', 'Imię i nazwisko z karty', 'Data ważności', 'CVV'].forEach((label) => {
      expect(screen.getByLabelText(label).value).toBe('');
    });

    fillCard();
    await pay();

    expect(await screen.findByText('Opłacono ZAM-5')).toBeTruthy();
    expect(payments(mock)).toHaveLength(2);
  });

  it('keeps the CVV out of a password field, so it is not offered for saving', async () => {
    stubApi(order);
    renderPage();

    const cvv = await screen.findByLabelText('CVV');

    expect(cvv.type).toBe('text');
    expect(cvv.autocomplete).toBe('off');
    expect(cvv.inputMode).toBe('numeric');
  });

  it('accepts digits only in the CVV', async () => {
    stubApi(order);
    renderPage();
    await screen.findByLabelText('CVV');

    type('CVV', '1a2');

    expect(screen.getByLabelText('CVV').value).toBe('12');
  });

  it('shows no form for an order that was already paid', async () => {
    stubApi({ ...order, payment_status: 'paid' });
    renderPage();

    expect(await screen.findByText('To zamówienie nie czeka na płatność kartą')).toBeTruthy();
    expect(screen.queryByLabelText('CVV')).toBeNull();
  });
});
