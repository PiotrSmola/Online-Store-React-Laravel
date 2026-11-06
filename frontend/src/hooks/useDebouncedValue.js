import { useEffect, useState } from 'react';

/** The value, held back until it has stopped changing for the delay. */
export function useDebouncedValue(value, delay) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
