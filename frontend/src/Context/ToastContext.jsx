import { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ToastList from '../Components/ui/Toast';
import { ToastContext } from './useToast';

const MAX_VISIBLE = 3;

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const show = useCallback((tone, message) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, tone, message }].slice(-MAX_VISIBLE));
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext value={value}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
