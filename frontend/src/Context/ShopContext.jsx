import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ApiError, getToken, isAbortError, onUnauthorized, storeToken } from '../lib/api';
import {
  addLine,
  cartFingerprint,
  cartFromStorageEvent,
  mergeCarts,
  readCart,
  removeLine,
  setLineQuantity,
  writeCart,
} from '../lib/cart';
import { getSavedCart, saveCart } from '../lib/cartSync';
import { getCurrentCustomer, signOut } from '../lib/session';
import { safeStorage } from '../lib/storage';
import { AUTH_STATUS } from './authStatus';
import { AuthContext, CartActionsContext, CartItemsContext, useAuth } from './useShop';

const NO_SESSION = { token: null, customer: null, failed: false };
const SAVE_DELAY_MS = 800;

function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [session, setSession] = useState(NO_SESSION);

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

  const signOutCustomer = useCallback(async () => {
    await signOut().catch(() => {});
    endSession();
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
    };
  }, [token, verified, session, signInWith, signOutCustomer, updateCustomer, retry]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

function CartProvider({ children }) {
  const { status, customer } = useAuth();
  const [items, setItems] = useState(() => readCart(safeStorage));
  const [mergedFor, setMergedFor] = useState(null);
  const savedCart = useRef(null);

  const customerId = status === AUTH_STATUS.authenticated ? customer.id : null;
  const syncing = customerId !== null && mergedFor === customerId;

  if (customerId === null && mergedFor !== null) setMergedFor(null);

  useEffect(() => {
    writeCart(safeStorage, items);
  }, [items]);

  // At sign-in the browser's cart and the account's become one.
  useEffect(() => {
    if (customerId === null || mergedFor === customerId) return undefined;

    const controller = new AbortController();

    getSavedCart({ signal: controller.signal }).then(
      (saved) => {
        savedCart.current = cartFingerprint(saved);
        setItems((current) => mergeCarts(current, saved));
        setMergedFor(customerId);
      },
      (error) => {
        if (!isAbortError(error)) setMergedFor(customerId);
      },
    );

    return () => controller.abort();
  }, [customerId, mergedFor]);

  // Saves the cart once changes stop, and at once if the page is closing before that.
  useEffect(() => {
    const fingerprint = cartFingerprint(items);
    if (!syncing || fingerprint === savedCart.current) return undefined;

    const controller = new AbortController();
    const save = (options) =>
      saveCart(items, options).then(
        () => {
          savedCart.current = fingerprint;
        },
        () => {},
      );

    const timer = setTimeout(() => save({ signal: controller.signal }), SAVE_DELAY_MS);
    const saveNow = () => {
      clearTimeout(timer);
      save({ keepalive: true });
    };

    window.addEventListener('pagehide', saveNow);
    return () => {
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener('pagehide', saveNow);
    };
  }, [items, syncing]);

  // Writing the same value back fires no event, so two tabs settle after one round.
  useEffect(() => {
    const handleStorage = (event) => {
      const cart = cartFromStorageEvent(event);
      if (cart) setItems(cart);
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
