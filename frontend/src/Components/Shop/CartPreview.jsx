import PropTypes from 'prop-types';
import { useCartItems } from '../../Context/useShop';
import { useCartQuote } from '../../hooks/useCartQuote';
import { lineKey } from '../../lib/cart';
import { countProducts, formatPrice } from '../../lib/format';
import { ButtonLink } from '../ui/Button';
import CartLine from './CartLine';

const VISIBLE_LINES = 4;

/** The content of the header's cart panel. It prices the cart only while it is open. */
export default function CartPreview({ onNavigate }) {
  const items = useCartItems();
  const { data: quote, error } = useCartQuote(items);
  const hidden = items.length - VISIBLE_LINES;

  if (items.length === 0) {
    return (
      <>
        <p className="font-medium">Twój koszyk jest pusty</p>
        <ButtonLink to="/products" block className="mt-4" onClick={onNavigate}>
          Zobacz produkty
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {items.slice(0, VISIBLE_LINES).map((item) => (
          <CartLine
            key={lineKey(item)}
            item={item}
            line={quote?.lines.find((line) => line.key === lineKey(item))}
            compact
          />
        ))}
      </ul>

      {hidden > 0 && <p className="mt-3 text-sm text-stone">Oraz {countProducts(hidden)} w koszyku</p>}
      {error && <p className="mt-3 text-sm text-ember">{error.message}</p>}

      <p aria-live="polite" className="mt-4 flex items-baseline justify-between gap-4">
        <span>Wartość produktów</span>
        <span className="font-semibold">{formatPrice(quote?.subtotal)}</span>
      </p>

      <div className="mt-4 grid gap-2">
        <ButtonLink to="/checkout" block onClick={onNavigate}>
          Przejdź do zamówienia
        </ButtonLink>
        <ButtonLink to="/cart" variant="secondary" block onClick={onNavigate}>
          Zobacz koszyk
        </ButtonLink>
      </div>
    </>
  );
}

CartPreview.propTypes = {
  onNavigate: PropTypes.func.isRequired,
};
