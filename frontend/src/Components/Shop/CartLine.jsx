import PropTypes from 'prop-types';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useCartActions } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { formatPrice } from '../../lib/format';
import { lineKey } from '../../lib/cart';
import { optionsText } from '../../lib/product';
import QuantityStepper from '../ui/QuantityStepper';
import Skeleton from '../ui/Skeleton';
import ProductImage from './ProductImage';

/**
 * One cart row. item is the stored line; line is its priced version, absent until the quote loads.
 * onRemoved must move focus, because removing the row removes the button that holds it.
 */
export default function CartLine({ item, line = null, compact = false, onRemoved }) {
  const { setQuantity, removeItem } = useCartActions();
  const toast = useToast();
  const key = lineKey(item);
  const name = line?.product?.nazwa ?? 'Produkt niedostępny';

  const handleRemove = () => {
    removeItem(key);
    toast.success(`Usunięto z koszyka: ${name}`);
    onRemoved();
  };

  return (
    <li className={`grid gap-x-4 ${compact ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[6rem_1fr] sm:grid-cols-[8rem_1fr]'}`}>
      {line?.product ? (
        <ProductImage image={line.product.images?.[0]} alt="" thumbnail priority="eager" />
      ) : (
        <Skeleton className="aspect-[3/4] w-full" />
      )}
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {line?.product ? (
              <Link to={`/product/${item.product_id}`} className="block font-medium underline-offset-4 hover:underline">
                {name}
              </Link>
            ) : (
              <p className="font-medium">{line ? name : ' '}</p>
            )}
            <p className="text-sm text-stone">{optionsText(item.size, item.color)}</p>
          </div>
          <p className="shrink-0 font-semibold">{line?.available ? formatPrice(line.line_total) : ''}</p>
        </div>
        {line?.error && <p className="mt-1 text-sm text-ember">{line.error}</p>}
        <div className={`flex items-center justify-between ${compact ? 'mt-1' : 'mt-3'}`}>
          <QuantityStepper
            value={item.quantity}
            max={line?.stock > 0 ? line.stock : undefined}
            onChange={(quantity) => setQuantity(key, quantity)}
            target={name}
          />
          <button
            type="button"
            aria-label={`Usuń z koszyka: ${name}`}
            className="grid size-11 cursor-pointer place-items-center rounded-control text-ember hover:bg-mist"
            onClick={handleRemove}
          >
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </li>
  );
}

CartLine.propTypes = {
  item: PropTypes.shape({
    product_id: PropTypes.number.isRequired,
    size: PropTypes.string,
    color: PropTypes.string,
    quantity: PropTypes.number.isRequired,
  }).isRequired,
  line: PropTypes.object,
  compact: PropTypes.bool,
  onRemoved: PropTypes.func.isRequired,
};
