import { useEffect } from 'react';
import { useLocation } from 'react-router';

let handledPath = null;

/**
 * Moves focus to the element once per route change. It runs when the element mounts, which for a
 * page waiting on data is after its heading appears. The first page of a visit keeps the
 * browser's starting focus, so the skip link stays the first stop for the Tab key.
 */
export function useRouteFocus(ref) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (handledPath === pathname) return;

    const isFirstPage = handledPath === null;
    handledPath = pathname;
    if (!isFirstPage) ref.current?.focus({ preventScroll: true });
  }, [pathname, ref]);
}
