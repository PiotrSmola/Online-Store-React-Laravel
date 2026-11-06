import { useEffect, useId, useRef } from 'react';
import PropTypes from 'prop-types';
import Button from './Button';

/**
 * Asks before an action that cannot be undone. The native modal dialog keeps focus inside, closes
 * on Escape and hands focus back to its trigger. Focus starts on the safe choice, cancel.
 */
export default function ConfirmDialog({ open, title, text, confirmLabel, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-control bg-white p-6 text-ink backdrop:bg-mist"
      onClose={onCancel}
    >
      <h2 id={titleId} className="text-2xl">
        {title}
      </h2>
      <p className="mt-2 text-stone">{text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Anuluj
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
