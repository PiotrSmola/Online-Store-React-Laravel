import PropTypes from 'prop-types';
import { lineKey } from '../../lib/cart';
import { formatPrice } from '../../lib/format';
import { optionsText } from '../../lib/product';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import ProductImage from './ProductImage';

const THUMB_SIZES = '3rem';

function SummaryLine({ item, line = null }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-3">
      {line?.product ? (
        <ProductImage image={line.product.images?.[0]} alt="" thumbnail priority="eager" sizes={THUMB_SIZES} />
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

function freeDeliveryText(quote) {
  if (!quote) return '';
  return quote.free_delivery_missing > 0
    ? `Do darmowej dostawy brakuje ${formatPrice(quote.free_delivery_missing)}.`
    : 'Masz darmową dostawę.';
}

export default function CheckoutSummary({ items, quote }) {
  const { data, error, reload } = quote;
  const delivery = data?.delivery_price;

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

      <div aria-live="polite">
        <dl className="mt-6 space-y-1">
          <div className="flex justify-between gap-4">
            <dt>Wartość produktów</dt>
            <dd>{formatPrice(data?.subtotal)}</dd>
          </div>
          {data?.discount > 0 && (
            <div className="flex justify-between gap-4">
              <dt>Rabat{data.coupon ? `: ${data.coupon.label}` : ''}</dt>
              <dd>-{formatPrice(data.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Dostawa</dt>
            <dd>{delivery === 0 ? 'Bezpłatnie' : formatPrice(delivery)}</dd>
          </div>
          <div className="flex justify-between gap-4 pt-2 text-xl font-semibold">
            <dt>Razem</dt>
            <dd>{formatPrice(data?.total)}</dd>
          </div>
        </dl>
        <p className="mt-2 min-h-5 text-sm text-stone">{freeDeliveryText(data)}</p>
      </div>
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
};
