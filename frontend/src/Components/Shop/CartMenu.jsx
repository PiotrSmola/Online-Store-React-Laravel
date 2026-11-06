import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useCartCount } from '../../Context/useShop';
import { countProducts } from '../../lib/format';
import CartPreview from './CartPreview';

const CLOSE_DELAY = 200;
const PANEL_ID = 'cart-preview';

/**
 * The cart link and its preview. A pointer opens the preview by hovering; the arrow button opens
 * it by keyboard and touch. The panel is positioned against the header.
 */
export default function CartMenu() {
  const count = useCartCount();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const wrapper = useRef(null);
  const toggle = useRef(null);
  const panel = useRef(null);
  const closeTimer = useRef(null);

  // A new page closes the preview for good, also when the person comes back to this page later.
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => setOpen(false);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // On the document, because a preview opened by hovering has no focus inside it.
  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };

    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (wrapper.current?.contains(document.activeElement)) toggle.current?.focus();
      setOpen(false);
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const handlePointerEnter = (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    setOpen(true);
  };

  const handlePointerLeave = (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY);
  };

  const handleBlur = (event) => {
    if (event.relatedTarget && !wrapper.current?.contains(event.relatedTarget)) close();
  };

  return (
    <div
      ref={wrapper}
      className="flex items-center gap-1"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}
    >
      <Link
        to="/cart"
        aria-label={`Koszyk, ${countProducts(count)}`}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-1 font-semibold hover:text-pine"
      >
        <ShoppingBag aria-hidden="true" className="size-6" />
        {count > 0 && <span>{count}</span>}
      </Link>
      <button
        ref={toggle}
        type="button"
        aria-label="Podgląd koszyka"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        className="grid size-11 cursor-pointer place-items-center rounded-control hover:text-pine"
        onClick={() => setOpen(!open)}
      >
        <ChevronDown aria-hidden="true" className={`size-4 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div
        ref={panel}
        id={PANEL_ID}
        tabIndex={-1}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-mist p-4 outline-none sm:left-auto sm:w-96 lg:right-4"
      >
        {open && <CartPreview onNavigate={close} onRemoved={() => panel.current?.focus()} />}
      </div>
    </div>
  );
}
