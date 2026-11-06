import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { formatDateTime, formatPrice } from '../../lib/format';
import { optionsText } from '../../lib/product';
import ProductImage from './ProductImage';


const PAYMENT_TONE = { paid: 'text-pine', failed: 'text-ember' };

/** The status in plain text. Cancelled is the one state that takes the error color. */
export function OrderStatus({ order }) {
  return (
    <span className={`font-semibold ${order.status === 'cancelled' ? 'text-ember' : 'text-pine'}`}>
      {order.status_label}
    </span>
  );
}

OrderStatus.propTypes = {
  order: PropTypes.shape({ status: PropTypes.string, status_label: PropTypes.string }).isRequired,
};

export function PaymentStatus({ order }) {
  return <span className={`font-semibold ${PAYMENT_TONE[order.payment_status] ?? ''}`}>{order.payment_status_label}</span>;
}

PaymentStatus.propTypes = OrderStatus.propTypes;

function Block({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

Block.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function deliveryCost(price) {
  return price === 0 ? 'Bezpłatnie' : formatPrice(price);
}

function AddressLines({ address }) {
  return (
    <address className="not-italic">
      <p>
        {address.first_name} {address.last_name}
      </p>
      {address.company_name && <p>{address.company_name}</p>}
      {address.nip && <p>NIP: {address.nip}</p>}
      <p>{address.address}</p>
      <p>
        {address.postal_code} {address.city}
      </p>
      <p>{address.country}</p>
    </address>
  );
}

AddressLines.propTypes = {
  address: PropTypes.object.isRequired,
};

export function OrderFacts({ order }) {
  const details = order.payment_details ?? {};
  const shipping = order.shipping_address ?? {};
  const point = shipping.pickup_point;

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <Block title="Płatność">
        <p>{order.payment_method_label}</p>
        <p>
          <PaymentStatus order={order} />
        </p>
        {details.card_last_four && <p className="text-stone">Karta z końcówką {details.card_last_four}</p>}
        {details.instructions && <p className="max-w-prose text-stone">{details.instructions}</p>}
      </Block>
      <Block title="Dostawa">
        <p>{order.delivery_method_label}</p>
        <p className="text-stone">Koszt: {deliveryCost(order.deliveryPrice)}</p>
        {point && <p className="text-stone">{point.address}</p>}
      </Block>
      <Block title="Adres dostawy">
        <AddressLines address={shipping} />
      </Block>
      <Block title="Dane do faktury">
        <AddressLines address={order.billing_address ?? {}} />
      </Block>
    </div>
  );
}

OrderFacts.propTypes = {
  order: PropTypes.object.isRequired,
};

export function OrderItems({ items }) {
  return (
    <Block title="Zamówione produkty">
      <ul className="mt-4 space-y-6">
        {items.map((item) => (
          <li key={item.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4">
            <ProductImage image={item.product?.images?.[0]} alt="" thumbnail />
            <div className="flex flex-wrap items-start justify-between gap-x-4">
              <div>
                {item.product ? (
                  <Link to={`/product/${item.product.id}`} className="block font-medium underline-offset-4 hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <p className="font-medium">{item.name}</p>
                )}
                <p className="text-sm text-stone">{optionsText(item.selected_size, item.selected_color)}</p>
                <p className="text-sm text-stone">
                  Ilość: {item.quantity}, cena za sztukę: {formatPrice(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

OrderItems.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export function OrderTotals({ order }) {
  return (
    <section aria-labelledby="order-totals" className="rounded-control bg-mist p-6">
      <h2 id="order-totals" className="text-2xl">
        Podsumowanie
      </h2>
      <dl className="mt-4 space-y-1">
        <div className="flex justify-between gap-4">
          <dt>Wartość produktów</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between gap-4">
            <dt>Rabat{order.coupon_code ? `: ${order.coupon_code}` : ''}</dt>
            <dd>-{formatPrice(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt>Dostawa</dt>
          <dd>{deliveryCost(order.deliveryPrice)}</dd>
        </div>
        <div className="flex justify-between gap-4 pt-2 text-xl font-semibold">
          <dt>Razem</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}

OrderTotals.propTypes = {
  order: PropTypes.object.isRequired,
};

export function OrderMeta({ order }) {
  return (
    <>
      <p className="mt-2 text-stone">Data zamówienia: {formatDateTime(order.order_date)}</p>
      <p className="text-stone">
        Status: <OrderStatus order={order} />
      </p>
    </>
  );
}

OrderMeta.propTypes = {
  order: PropTypes.object.isRequired,
};

export function OrderHistory({ events }) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="order-history">
      <h2 id="order-history" className="mb-2 text-2xl">
        Historia zamówienia
      </h2>
      <ol className="space-y-3">
        {events.map((event) => (
          <li key={event.id}>
            <p className="font-medium">{event.status_label}</p>
            <p className="text-sm text-stone">{formatDateTime(event.created_at)}</p>
            {event.note && <p className="max-w-prose text-stone">{event.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

OrderHistory.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object).isRequired,
};
