import PropTypes from 'prop-types';
import { lineKey } from '../../lib/cart';
import { formatPrice } from '../../lib/format';
import { optionsText } from '../../lib/product';
import { deliveryLabel } from '../../lib/shopConfig';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import ProductImage from './ProductImage';

function SummaryLine({ item, line = null }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-3">
      {line?.product ? (
        <ProductImage image={line.product.images?.[0]} alt="" thumbnail priority="eager" />
      ) : (
        <Skeleton className="aspect-[3/4] w-full bg-white" />
      )}
      <div className="min-w-0 text-sm">
        <p className="font-medium">{line?.product?.nazwa ?? ' '}</p>
        {(item.size || item.color) && <p className="text-stone">{optionsText(item.size, item.color)}</p>}
        <p className="text-stone">Ilość: {item.quantity}</p>
        {line?.error && <p className="text-ember">{line.error}</p>}
        <p className="font-semibold">{line?.available ? formatPrice(line.line_total) : ''}</p>
      </div>
    </li>
  );
}

SummaryLine.propTypes = {
  item: PropTypes.object.isRequired,
  line: PropTypes.object,
};

export default function CheckoutSummary({ items, quote, deliveryMethod }) {
  const { data, error, reload } = quote;

  return (
    <aside aria-labelledby="checkout-summary" className="rounded-control bg-mist p-6 lg:sticky lg:top-8 lg:self-start">
      <h2 id="checkout-summary" className="text-2xl">
        Podsumowanie
      </h2>

      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <SummaryLine
            key={lineKey(item)}
            item={item}
            line={data?.lines.find((line) => line.key === lineKey(item))}
          />
        ))}
      </ul>

      {error && (
        <div className="mt-4">
          <p className="text-ember">{error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={reload}>
            Spróbuj ponownie
          </Button>
        </div>
      )}

      <dl aria-live="polite" className="mt-6 space-y-1">
        <div className="flex justify-between gap-4">
          <dt>Wartość produktów</dt>
          <dd>{formatPrice(data?.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Dostawa: {deliveryLabel(deliveryMethod)}</dt>
          <dd>{data?.delivery_price === 0 ? 'Bezpłatnie' : formatPrice(data?.delivery_price)}</dd>
        </div>
        <div className="flex justify-between gap-4 pt-2 text-xl font-semibold">
          <dt>Razem</dt>
          <dd>{formatPrice(data?.total)}</dd>
        </div>
      </dl>
    </aside>
  );
}

CheckoutSummary.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  quote: PropTypes.shape({
    data: PropTypes.object,
    error: PropTypes.object,
    reload: PropTypes.func.isRequired,
  }).isRequired,
  deliveryMethod: PropTypes.string.isRequired,
};
