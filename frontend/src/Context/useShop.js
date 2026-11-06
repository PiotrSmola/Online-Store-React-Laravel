import { createContext, useContext, useMemo } from 'react';
import { countItems } from '../lib/cart';

export const AuthContext = createContext(null);
export const CartItemsContext = createContext(null);
export const CartActionsContext = createContext(null);

function useRequired(context, name) {
  const value = useContext(context);
  if (value === null) throw new Error(`${name} must be used within a ShopProvider`);
  return value;
}

/** { status, customer, signInWith, signOutCustomer, retry }. See AUTH_STATUS for the status. */
export function useAuth() {
  return useRequired(AuthContext, 'useAuth');
}

export function useCartItems() {
  return useRequired(CartItemsContext, 'useCartItems');
}

/** Stable functions, so a component that only adds to the cart does not rerender with it. */
export function useCartActions() {
  return useRequired(CartActionsContext, 'useCartActions');
}

export function useCartCount() {
  const items = useCartItems();
  return useMemo(() => countItems(items), [items]);
}
