import { useCallback, useState } from 'react';
import { addToWishlist, getWishlistIds, removeFromWishlist } from '../lib/wishlist';
import { useResource } from './useResource';

/**
 * Whether a product is saved, for a signed-in customer. The toggle shows the new state straight
 * away and goes back if the request fails.
 */
export function useWishlistItem(productId, { enabled }) {
  const load = useCallback((signal) => getWishlistIds({ signal }), []);
  const { data: ids, loading } = useResource(load, enabled ? 'wishlist-ids' : null);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState(false);

  const saved = override?.productId === productId ? override.saved : (ids?.has(productId) ?? false);

  const toggle = useCallback(async () => {
    const next = !saved;
    setBusy(true);
    setOverride({ productId, saved: next });

    try {
      await (next ? addToWishlist(productId) : removeFromWishlist(productId));
      return next;
    } catch (error) {
      setOverride({ productId, saved: !next });
      throw error;
    } finally {
      setBusy(false);
    }
  }, [productId, saved]);

  return { saved, loading, busy, toggle };
}
