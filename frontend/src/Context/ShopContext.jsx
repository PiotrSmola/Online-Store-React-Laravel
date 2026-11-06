import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ApiError, getToken, isAbortError, onUnauthorized, storeToken } from '../lib/api';
import {
  addLine,
  cartFingerprint,
  cartFromStorageEvent,
  mergeCarts,
  ownerFromStorageEvent,
  readCart,
  readCartOwner,
  removeLine,
  setLineQuantity,
  writeCart,
  writeCartOwner,
} from '../lib/cart';
import { getSavedCart, saveCart } from '../lib/cartSync';
import { getCurrentCustomer, signOut } from '../lib/session';
import { safeStorage } from '../lib/storage';
import { AUTH_STATUS } from './authStatus';
import { AuthContext, CartActionsContext, CartItemsContext, useAuth } from './useShop';
import { useToast } from './useToast';

const NO_SESSION = { token: null, customer: null, failed: false };
const SAVE_DELAY_MS = 800;
const FLUSH_TIMEOUT_MS = 3000;
const MERGE_RETRY_DELAYS_MS = [2000, 5000, 15000];

function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [session, setSession] = useState(NO_SESSION);
  const cartSession = useRef(null);

  const endSession = useCallback(() => {
    storeToken(null);
    setToken(null);
    setSession(NO_SESSION);
  }, []);

  useEffect(() => onUnauthorized(endSession), [endSession]);

  const verified = session.token === token;

  useEffect(() => {
    if (!token || verified) return undefined;

    const controller = new AbortController();

    getCurrentCustomer({ signal: controller.signal }).then(
      (customer) => setSession({ token, customer, failed: false }),
      (error) => {
        if (isAbortError(error)) return;
        if (error instanceof ApiError && error.status === 401) endSession();
        else setSession({ token, customer: null, failed: true });
      },
    );

    return () => controller.abort();
  }, [token, verified, endSession]);

  const signInWith = useCallback((customer, newToken) => {
    storeToken(newToken);
    setToken(newToken);
    setSession({ token: newToken, customer, failed: false });
  }, []);

  const bindCartSession = useCallback((handlers) => {
    cartSession.current = handlers;
    return () => {
      cartSession.current = null;
    };
  }, []);

  // The token must still work for the last save, so the cart goes first.
  const signOutCustomer = useCallback(async () => {
    await cartSession.current?.flush();
    await signOut().catch(() => {});
    endSession();
    cartSession.current?.forget();
  }, [endSession]);

  const retry = useCallback(() => setSession(NO_SESSION), []);

  const updateCustomer = useCallback((customer) => {
    setSession((current) => ({ ...current, customer }));
  }, []);

  const value = useMemo(() => {
    let status = AUTH_STATUS.loading;
    if (!token) status = AUTH_STATUS.guest;
    else if (verified && session.customer) status = AUTH_STATUS.authenticated;
    else if (verified && session.failed) status = AUTH_STATUS.unknown;

    return {
      status,
      customer: verified ? session.customer : null,
      signInWith,
      signOutCustomer,
      updateCustomer,
      retry,
      bindCartSession,
    };
  }, [token, verified, session, signInWith, signOutCustomer, updateCustomer, retry, bindCartSession]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

/**
 * What a session's end does to the cart:
 * - Logout: pending changes are saved to the account first, then the browser forgets the cart.
 * - Expiry (a 401): the lines stay, tagged with their owner, so nothing is lost mid-shopping. The
 *   same customer gets them back at the next login. Anyone else's login drops them at once.
 */
function CartProvider({ children }) {
  const { status, customer, bindCartSession } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(() => readCart(safeStorage));
  const [cartOwner, setCartOwner] = useState(() => readCartOwner(safeStorage));
  const [mergedFor, setMergedFor] = useState(null);
  const [mergeAttempt, setMergeAttempt] = useState(0);
  const savedCart = useRef(null);
  const pendingSave = useRef(null);

  const customerId = status === AUTH_STATUS.authenticated ? customer.id : null;
  // Saving replaces the account's cart, so it waits until that cart has been read and merged.
  const syncing = customerId !== null && mergedFor === customerId;

  if (customerId === null && (mergedFor !== null || mergeAttempt !== 0)) {
    setMergedFor(null);
    setMergeAttempt(0);
  }

  if (customerId !== null && cartOwner !== null && cartOwner !== String(customerId)) {
    setCartOwner(null);
    setItems([]);
  }

  if (!syncing && items.length === 0 && cartOwner !== null) setCartOwner(null);

  useEffect(() => {
    writeCart(safeStorage, items);
  }, [items]);

  useEffect(() => {
    writeCartOwner(safeStorage, cartOwner);
  }, [cartOwner]);

  useEffect(() => {
    if (customerId === null) savedCart.current = null;
  }, [customerId]);

  // At sign-in the browser's cart and the account's become one. Until the account's cart has
  // been read nothing is saved, because a save would overwrite it.
  useEffect(() => {
    if (customerId === null || mergedFor === customerId) return undefined;

    const controller = new AbortController();
    let retryTimer;

    getSavedCart({ signal: controller.signal }).then(
      (saved) => {
        savedCart.current = cartFingerprint(saved);
        setItems((current) => mergeCarts(current, saved));
        setCartOwner(String(customerId));
        setMergedFor(customerId);
      },
      (error) => {
        if (isAbortError(error) || error.status === 401) return;

        const delay = MERGE_RETRY_DELAYS_MS[mergeAttempt];

        if (mergeAttempt === 0) toast.error('Nie udało się wczytać koszyka z konta. Próbujemy ponownie.');

        if (delay === undefined) toast.error('Nie udało się wczytać koszyka z konta. Odśwież stronę.');
        else retryTimer = setTimeout(() => setMergeAttempt((attempt) => attempt + 1), delay);
      },
    );

    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [customerId, mergedFor, mergeAttempt, toast]);

  // Saves the cart once changes stop, and at once if the page is closing before that.
  useEffect(() => {
    const fingerprint = cartFingerprint(items);
    pendingSave.current = null;

    if (!syncing || fingerprint === savedCart.current) return undefined;

    const controller = new AbortController();
    let timer;

    const saveNow = (options) => {
      clearTimeout(timer);

      return saveCart(items, options).then(
        () => {
          savedCart.current = fingerprint;
          if (pendingSave.current === saveNow) pendingSave.current = null;
        },
        () => {},
      );
    };

    const saveOnPageHide = () => saveNow({ keepalive: true });

    pendingSave.current = saveNow;
    timer = setTimeout(() => saveNow({ signal: controller.signal }), SAVE_DELAY_MS);
    window.addEventListener('pagehide', saveOnPageHide);

    return () => {
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener('pagehide', saveOnPageHide);
    };
  }, [items, syncing]);

  const flush = useCallback(
    () => pendingSave.current?.({ signal: AbortSignal.timeout(FLUSH_TIMEOUT_MS) }) ?? Promise.resolve(),
    [],
  );

  const forget = useCallback(() => {
    setItems([]);
    setCartOwner(null);
  }, []);

  useEffect(() => bindCartSession({ flush, forget }), [bindCartSession, flush, forget]);

  // Writing the same value back fires no event, so two tabs settle after one round.
  useEffect(() => {
    const handleStorage = (event) => {
      const cart = cartFromStorageEvent(event);
      if (cart) setItems(cart);

      const owner = ownerFromStorageEvent(event);
      if (owner !== undefined) setCartOwner(owner);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const actions = useMemo(
    () => ({
      addItem: (line) => setItems((current) => addLine(current, line)),
      setQuantity: (key, quantity) => setItems((current) => setLineQuantity(current, key, quantity)),
      removeItem: (key) => setItems((current) => removeLine(current, key)),
      clear: () => setItems([]),
    }),
    [],
  );

  return (
    <CartActionsContext value={actions}>
      <CartItemsContext value={items}>{children}</CartItemsContext>
    </CartActionsContext>
  );
}

const childrenProps = { children: PropTypes.node.isRequired };
AuthProvider.propTypes = childrenProps;
CartProvider.propTypes = childrenProps;

export default function ShopProvider({ children }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

ShopProvider.propTypes = childrenProps;
