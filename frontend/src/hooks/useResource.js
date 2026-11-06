import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '../lib/api';

/**
 * Loads data for a key and aborts the request when the key changes or the component unmounts, so
 * a stale response never reaches state.
 *
 * @param {(signal: AbortSignal) => Promise<unknown>} load Must be stable between renders.
 * @param {string | null} key What is being loaded. null loads nothing.
 * @param {{ keepPrevious?: boolean }} [options] Keep showing old data while new data loads.
 */
export function useResource(load, key, { keepPrevious = false } = {}) {
  const [settled, setSettled] = useState({ requestId: null, data: undefined, error: null });
  const [attempt, setAttempt] = useState(0);
  const requestId = key === null ? null : `${attempt}:${key}`;

  useEffect(() => {
    if (requestId === null) return undefined;

    const controller = new AbortController();

    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ requestId, data, error: null });
      },
      (error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setSettled({ requestId, data: undefined, error });
        }
      },
    );

    return () => controller.abort();
  }, [load, requestId]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  const isCurrent = settled.requestId === requestId;

  return {
    data: isCurrent || keepPrevious ? settled.data : undefined,
    error: isCurrent ? settled.error : null,
    loading: requestId !== null && !isCurrent,
    reload,
  };
}
