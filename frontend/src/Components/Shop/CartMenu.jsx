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
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const wrapper = useRef(null);
  const toggle = useRef(null);
  const closeTimer = useRef(null);

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => setOpenOn(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event) => {
      if (!wrapper.current?.contains(event.target)) setOpenOn(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const handlePointerEnter = (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    setOpenOn(pathname);
  };

  const handlePointerLeave = (event) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      close();
      toggle.current?.focus();
    }
  };

  const handleBlur = (event) => {
    if (event.relatedTarget && !wrapper.current?.contains(event.relatedTarget)) close();
  };

  return (
    <div
      ref={wrapper}
      className="flex items-center"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
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
        className="grid h-11 w-8 cursor-pointer place-items-center rounded-control hover:text-pine"
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        <ChevronDown aria-hidden="true" className={`size-4 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div
        id={PANEL_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-mist p-4 sm:left-auto sm:w-96 lg:right-4"
      >
        {open && <CartPreview onNavigate={close} />}
      </div>
    </div>
  );
}
