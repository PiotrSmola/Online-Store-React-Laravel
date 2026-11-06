// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSavedCart, saveCart } from '../lib/cartSync';
import { ApiError, getToken, storeToken } from '../lib/api';
import { getCurrentCustomer, signOut } from '../lib/session';
import ShopProvider from './ShopContext';
import ToastProvider from './ToastContext';
import { useAuth, useCartActions, useCartItems } from './useShop';

vi.mock('../lib/cartSync', () => ({ getSavedCart: vi.fn(), saveCart: vi.fn() }));
vi.mock('../lib/session', () => ({ getCurrentCustomer: vi.fn(), signOut: vi.fn() }));

const shirt = { product_id: 1, size: 'M', color: 'Czarny', quantity: 1 };
const belt = { product_id: 2, size: null, color: null, quantity: 1 };
const anna = { id: 7, first_name: 'Anna' };
const piotr = { id: 8, first_name: 'Piotr' };

const SAVE_DELAY = 800;
const TIME_STEP = 500;
const authError = new ApiError('Nie zalogowano', { status: 401 });

let shop;

function Probe() {
  const items = useCartItems();
  const actions = useCartActions();
  const auth = useAuth();

  useEffect(() => {
    shop = { items, actions, auth };
  });

  return null;
}

// React applies state when act ends, so a retry chain needs time to pass in several steps.
async function settle(ms = 0) {
  let left = ms;

  do {
    const step = Math.min(left, TIME_STEP);
    left -= step;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  } while (left > 0);
}

async function mount() {
  render(
    <ToastProvider>
      <ShopProvider>
        <Probe />
      </ShopProvider>
    </ToastProvider>,
  );
  await settle();
}

function signedInAs(customer, { local = [], saved = [] } = {}) {
  storeToken('token');
  if (local.length > 0) localStorage.setItem('cart', JSON.stringify(local));
  getCurrentCustomer.mockResolvedValue(customer);
  getSavedCart.mockResolvedValue(saved);
}

const savedItems = (call = -1) => saveCart.mock.calls.at(call)[0];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  storeToken(null);
  vi.clearAllMocks();
  saveCart.mockResolvedValue({});
  signOut.mockResolvedValue({});
  getSavedCart.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('merge at sign-in', () => {
  it('joins the browser cart and the account cart', async () => {
    signedInAs(anna, { local: [shirt], saved: [belt] });
    await mount();

    expect(shop.items).toEqual([shirt, belt]);
  });

  it('saves the merged cart, because the account does not have it yet', async () => {
    signedInAs(anna, { local: [shirt], saved: [belt] });
    await mount();
    await settle(SAVE_DELAY);

    expect(saveCart).toHaveBeenCalledOnce();
    expect(savedItems()).toEqual([shirt, belt]);
  });

  it('saves nothing when the two carts already match', async () => {
    signedInAs(anna, { local: [shirt], saved: [shirt] });
    await mount();
    await settle(SAVE_DELAY * 2);

    expect(saveCart).not.toHaveBeenCalled();
  });

  it('merges a guest cart at login', async () => {
    localStorage.setItem('cart', JSON.stringify([shirt]));
    getSavedCart.mockResolvedValue([belt]);
    await mount();

    await act(async () => shop.auth.signInWith(anna, 'token'));
    await settle();

    expect(shop.items).toEqual([shirt, belt]);
  });
});

describe('debounced save', () => {
  it('sends one PUT for several quick changes, with the last state', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();

    act(() => shop.actions.setQuantity('1:M:Czarny', 2));
    await settle(300);
    act(() => shop.actions.setQuantity('1:M:Czarny', 3));
    await settle(300);
    act(() => shop.actions.setQuantity('1:M:Czarny', 4));
    await settle(SAVE_DELAY - 1);
    expect(saveCart).not.toHaveBeenCalled();

    await settle(1);
    expect(saveCart).toHaveBeenCalledOnce();
    expect(savedItems()[0].quantity).toBe(4);
  });

  it('does not repeat a save that succeeded', async () => {
    signedInAs(anna);
    await mount();

    act(() => shop.actions.addItem(belt));
    await settle(SAVE_DELAY);
    await settle(SAVE_DELAY * 2);

    expect(saveCart).toHaveBeenCalledOnce();
  });

  it('does not save for a guest', async () => {
    await mount();

    act(() => shop.actions.addItem(belt));
    await settle(SAVE_DELAY * 2);

    expect(saveCart).not.toHaveBeenCalled();
  });
});

describe('pagehide flush', () => {
  it('saves at once with keepalive when the page closes', async () => {
    signedInAs(anna);
    await mount();

    act(() => shop.actions.addItem(belt));
    await settle(100);
    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(saveCart).toHaveBeenCalledOnce();
    expect(saveCart.mock.calls[0][1]).toEqual({ keepalive: true });
  });

  it('does not save the same change again when the delay ends', async () => {
    signedInAs(anna);
    await mount();

    act(() => shop.actions.addItem(belt));
    window.dispatchEvent(new Event('pagehide'));
    await settle(SAVE_DELAY * 2);

    expect(saveCart).toHaveBeenCalledOnce();
  });

  it('sends nothing when no change is waiting', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();

    window.dispatchEvent(new Event('pagehide'));
    await settle();

    expect(saveCart).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('saves a change made just before logout, while the token still works', async () => {
    signedInAs(anna);
    await mount();

    const order = [];
    saveCart.mockImplementation(async () => {
      order.push(`save with ${getToken()}`);
    });
    signOut.mockImplementation(async () => {
      order.push(`logout with ${getToken()}`);
    });

    act(() => shop.actions.addItem(belt));
    await settle(100);
    await act(async () => shop.auth.signOutCustomer());

    expect(order).toEqual(['save with token', 'logout with token']);
    expect(savedItems()).toEqual([belt]);
  });

  it('skips the extra save when nothing is waiting', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();

    await act(async () => shop.auth.signOutCustomer());

    expect(saveCart).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('still logs out when the last save fails', async () => {
    signedInAs(anna);
    await mount();
    saveCart.mockRejectedValue(new Error('down'));

    act(() => shop.actions.addItem(belt));
    await act(async () => shop.auth.signOutCustomer());

    expect(getToken()).toBeNull();
    expect(shop.items).toEqual([]);
  });

  it('empties the cart and removes its storage keys', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    expect(localStorage.getItem('cart')).not.toBeNull();

    await act(async () => shop.auth.signOutCustomer());
    await settle();

    expect(shop.items).toEqual([]);
    expect(localStorage.getItem('cart')).toBeNull();
    expect(localStorage.getItem('cartOwner')).toBeNull();
  });

  it('does not overwrite the account with the emptied cart', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();

    await act(async () => shop.auth.signOutCustomer());
    await settle(SAVE_DELAY * 2);

    expect(saveCart).not.toHaveBeenCalled();
  });

  it("never carries one customer's lines into the next account", async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await act(async () => shop.auth.signOutCustomer());
    await settle();

    getSavedCart.mockResolvedValue([belt]);
    await act(async () => shop.auth.signInWith(piotr, 'other-token'));
    await settle(SAVE_DELAY * 2);

    expect(shop.items).toEqual([belt]);
    expect(saveCart).not.toHaveBeenCalled();
  });
});

describe('expired session', () => {
  async function expireSession() {
    getCurrentCustomer.mockRejectedValue(authError);
    await act(async () => shop.auth.retry());
    await settle();
    expect(getToken()).toBeNull();
  }

  it('keeps the lines for a person who expires mid-shopping', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await settle();

    await expireSession();

    expect(shop.items).toEqual([shirt]);
    expect(localStorage.getItem('cartOwner')).toBe('7');
  });

  it('sends nothing with the dead session', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();

    await expireSession();
    act(() => shop.actions.addItem(belt));
    await settle(SAVE_DELAY * 2);

    expect(saveCart).not.toHaveBeenCalled();
  });

  it('gives the lines back to the same customer, with changes made since', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await expireSession();
    act(() => shop.actions.addItem(belt));

    getSavedCart.mockResolvedValue([shirt]);
    await act(async () => shop.auth.signInWith(anna, 'new-token'));
    await settle(SAVE_DELAY);

    expect(shop.items).toEqual([shirt, belt]);
    expect(savedItems()).toEqual([shirt, belt]);
  });

  it('drops the lines at once when someone else logs in', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await expireSession();

    getSavedCart.mockResolvedValue([belt]);
    await act(async () => shop.auth.signInWith(piotr, 'other-token'));
    expect(shop.items).not.toContainEqual(shirt);

    await settle(SAVE_DELAY * 2);
    expect(shop.items).toEqual([belt]);
    expect(saveCart).not.toHaveBeenCalled();
  });

  it("does not show the old lines if the next person's cart fails to load", async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await expireSession();

    getSavedCart.mockRejectedValue(new Error('down'));
    await act(async () => shop.auth.signInWith(piotr, 'other-token'));
    await settle();

    expect(shop.items).toEqual([]);
  });

  it('remembers the owner across a reload', async () => {
    localStorage.setItem('cart', JSON.stringify([shirt]));
    localStorage.setItem('cartOwner', '7');
    getSavedCart.mockResolvedValue([belt]);
    await mount();

    await act(async () => shop.auth.signInWith(piotr, 'other-token'));
    await settle();

    expect(shop.items).toEqual([belt]);
  });

  it('forgets the owner when the cart becomes empty, so later guest lines stay', async () => {
    signedInAs(anna, { saved: [shirt] });
    await mount();
    await expireSession();

    act(() => shop.actions.clear());
    await settle();
    expect(localStorage.getItem('cartOwner')).toBeNull();

    act(() => shop.actions.addItem(belt));
    getSavedCart.mockResolvedValue([]);
    await act(async () => shop.auth.signInWith(piotr, 'other-token'));
    await settle();

    expect(shop.items).toEqual([belt]);
  });
});

describe('a failed read of the account cart', () => {
  it('never saves over the account cart', async () => {
    signedInAs(anna, { local: [shirt] });
    getSavedCart.mockRejectedValue(new Error('down'));
    await mount();

    await settle(SAVE_DELAY * 2);
    act(() => shop.actions.addItem(belt));
    await settle(30000);

    expect(saveCart).not.toHaveBeenCalled();
  });

  it('never empties the account when the browser cart is empty', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(new Error('down'));
    await mount();

    await settle(30000);

    expect(saveCart).not.toHaveBeenCalled();
  });

  it('tells the person once while retrying', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(new Error('down'));
    await mount();
    await settle(2000);

    expect(screen.getAllByText(/Próbujemy ponownie/)).toHaveLength(1);
    expect(getSavedCart).toHaveBeenCalledTimes(2);
  });

  it('retries with a growing delay, then merges and starts saving', async () => {
    signedInAs(anna, { local: [shirt] });
    getSavedCart.mockRejectedValueOnce(new Error('down')).mockResolvedValue([belt]);
    await mount();
    expect(shop.items).toEqual([shirt]);

    await settle(2000);
    expect(shop.items).toEqual([shirt, belt]);

    await settle(SAVE_DELAY);
    expect(savedItems()).toEqual([shirt, belt]);
  });

  it('stops after the last retry and asks for a reload', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(new Error('down'));
    await mount();
    await settle(2000 + 5000 + 15000);

    expect(getSavedCart).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/Odśwież stronę/)).toBeTruthy();

    await settle(60000);
    expect(getSavedCart).toHaveBeenCalledTimes(4);
    expect(saveCart).not.toHaveBeenCalled();
  });

  it('does not retry an abort', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await mount();
    await settle(30000);

    expect(getSavedCart).toHaveBeenCalledOnce();
    expect(screen.queryByText(/koszyka z konta/)).toBeNull();
  });

  it('does not retry a 401, which ends the session', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(authError);
    await mount();
    await settle(30000);

    expect(getSavedCart).toHaveBeenCalledOnce();
  });

  it('cancels a waiting retry on logout', async () => {
    signedInAs(anna);
    getSavedCart.mockRejectedValue(new Error('down'));
    await mount();

    await act(async () => shop.auth.signOutCustomer());
    await settle(30000);

    expect(getSavedCart).toHaveBeenCalledOnce();
  });
});

describe('another tab', () => {
  it('follows a cart saved elsewhere', async () => {
    await mount();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'cart', newValue: JSON.stringify([belt]) }));
    });

    expect(shop.items).toEqual([belt]);
  });
});
