import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** { success(message), error(message) }. The functions are stable between renders. */
export function useToast() {
  const value = useContext(ToastContext);
  if (value === null) throw new Error('useToast must be used within a ToastProvider');
  return value;
}
