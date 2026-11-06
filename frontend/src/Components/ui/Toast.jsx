import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

const DURATION = { success: 5000, error: 9000 };
const TONE = { success: 'bg-ink', error: 'bg-ember' };

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), DURATION[toast.tone]);
    return () => clearTimeout(timer);
  }, [paused, toast, onDismiss]);

  return (
    <li
      className={`flex animate-toast-in items-center justify-between gap-2 rounded-control py-1 pr-1 pl-4 text-white ${TONE[toast.tone]}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="py-2">{toast.message}</span>
      <button
        type="button"
        aria-label="Zamknij powiadomienie"
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-control focus-visible:outline-white"
        onClick={() => onDismiss(toast.id)}
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </li>
  );
}

ToastItem.propTypes = {
  toast: PropTypes.shape({
    id: PropTypes.number.isRequired,
    tone: PropTypes.oneOf(['success', 'error']).isRequired,
    message: PropTypes.string.isRequired,
  }).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

/** The list is always mounted, because a live region must exist before its content changes. */
export default function ToastList({ toasts, onDismiss }) {
  return (
    <ul
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Powiadomienia"
      className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:right-auto sm:w-96 lg:left-8"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}

ToastList.propTypes = {
  toasts: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDismiss: PropTypes.func.isRequired,
};
