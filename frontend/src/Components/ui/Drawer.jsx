import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

const DESKTOP = '(min-width: 64rem)';

/**
 * A full screen panel on a native modal dialog, which keeps focus inside, closes on Escape and
 * hands focus back to the button that opened it.
 */
export default function Drawer({ open, onClose, label, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const desktop = window.matchMedia(DESKTOP);
    desktop.addEventListener('change', onClose);
    return () => desktop.removeEventListener('change', onClose);
  }, [open, onClose]);

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      className="m-0 h-dvh max-h-none w-full max-w-none animate-drawer-in overflow-y-auto bg-white text-ink"
      onClose={onClose}
    >
      <div className="gutter flex h-16 items-center">
        <button
          type="button"
          aria-label="Zamknij menu"
          className="-ml-2.5 grid size-11 cursor-pointer place-items-center rounded-control"
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-6" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

Drawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
