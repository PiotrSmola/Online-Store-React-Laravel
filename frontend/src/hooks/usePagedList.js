import { startTransition, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useResource } from './useResource';

/**
 * A paged list whose page and filters live in the URL. fetchPage(query, { signal }) must be stable,
 * which a function imported from src/lib is.
 */
export function usePagedList(fetchPage) {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.toString();

  const load = useCallback(
    (signal) => fetchPage(Object.fromEntries(new URLSearchParams(key)), { signal }),
    [fetchPage, key],
  );
  const resource = useResource(load, key, { keepPrevious: true });

  const setQuery = useCallback(
    (changes) => {
      const next = new URLSearchParams(key);
      next.delete('page');
      Object.entries(changes).forEach(([name, value]) => {
        if (value) next.set(name, value);
        else next.delete(name);
      });
      startTransition(() => setSearchParams(next, { replace: true }));
    },
    [key, setSearchParams],
  );

  const hrefFor = useCallback(
    (page) => {
      const next = new URLSearchParams(key);
      if (page > 1) next.set('page', page);
      else next.delete('page');
      const search = next.toString();
      return search ? `${pathname}?${search}` : pathname;
    },
    [key, pathname],
  );

  return { ...resource, query: Object.fromEntries(new URLSearchParams(key)), setQuery, hrefFor };
}
