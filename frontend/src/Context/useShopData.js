import { createContext, useContext } from 'react';

export const ShopDataContext = createContext(null);

/** The small lists every page shares: { categories, config }, each a useResource result. */
export function useShopData() {
  const value = useContext(ShopDataContext);
  if (value === null) throw new Error('useShopData must be used within the shop layout');
  return value;
}
