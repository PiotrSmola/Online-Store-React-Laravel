import { useCallback, useEffect, useState } from 'react';

/**
 * Returns a function that moves focus to the page's h1 after the next commit, for when an action
 * removes the focused control. Running after the commit also reaches an h1 that the same update
 * rendered, such as the empty cart's heading.
 */
export function useFocusPageHeading() {
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    if (requests > 0) document.querySelector('main h1')?.focus();
  }, [requests]);

  return useCallback(() => setRequests((count) => count + 1), []);
}
