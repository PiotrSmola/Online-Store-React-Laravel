import PropTypes from 'prop-types';
import { formatDateTime, formatPrice } from '../../lib/format';
import { optionsText } from '../../lib/product';
import { deliveryLabel, orderStatusLabel, paymentLabel } from '../../lib/shopConfig';
import ProductImage from './ProductImage';

const orderShape = PropTypes.shape({
  order_number: PropTypes.string,
  order_date: PropTypes.string,
  status: PropTypes.string,
  payment_method: PropTypes.string,
  delivery_method: PropTypes.string,
  payment_details: PropTypes.object,
  shipping_address: PropTypes.object,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  total: PropTypes.number.isRequired,
  deliveryPrice: PropTypes.number.isRequired,
  itemsTotal: PropTypes.number.isRequired,
});

/** The status in plain text. Cancelled is the one state that takes the error color. */
export function OrderStatus({ status }) {
  return (
    <span className={`font-semibold ${status === 'cancelled' ? 'text-ember' : 'text-pine'}`}>
      {orderStatusLabel(status)}
    </span>
  );
}

OrderStatus.propTypes = {
  status: PropTypes.string,
};

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

export function OrderFacts({ order }) {
  const details = order.payment_details ?? {};
  const address = order.shipping_address ?? {};

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <Block title="Płatność">
        <p>{paymentLabel(order.payment_method ?? details.method)}</p>
        {details.card_last_four && <p className="text-stone">Karta z końcówką {details.card_last_four}</p>}
        {details.instructions && <p className="max-w-prose text-stone">{details.instructions}</p>}
      </Block>
      <Block title="Dostawa">
        <p>{deliveryLabel(order.delivery_method)}</p>
        <p className="text-stone">Koszt: {deliveryCost(order.deliveryPrice)}</p>
      </Block>
      <Block title="Adres dostawy">
        <address className="not-italic">
          <p>
            {address.first_name} {address.last_name}
          </p>
          {address.company_name && <p>{address.company_name}</p>}
          <p>{address.address}</p>
          <p>
            {address.postal_code} {address.city}
          </p>
          <p>{address.country}</p>
        </address>
      </Block>
    </div>
  );
}

OrderFacts.propTypes = {
  order: orderShape.isRequired,
};

export function OrderItems({ items }) {
  return (
    <Block title="Zamówione produkty">
      <ul className="mt-4 space-y-6">
        {items.map((item) => {
          const name = item.product?.nazwa ?? 'Produkt niedostępny';

          return (
            <li key={item.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4">
              <ProductImage image={item.product?.images?.[0]} alt="" thumbnail />
              <div className="flex flex-wrap items-start justify-between gap-x-4">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-stone">{optionsText(item.selected_size, item.selected_color)}</p>
                  <p className="text-sm text-stone">
                    Ilość: {item.quantity}, cena za sztukę: {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <p className="font-semibold">{formatPrice(item.lineTotal)}</p>
              </div>
            </li>
          );
        })}
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
          <dd>{formatPrice(order.itemsTotal)}</dd>
        </div>
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
  order: orderShape.isRequired,
};

export function OrderMeta({ order }) {
  return (
    <p className="mt-2 text-stone">
      {formatDateTime(order.order_date)}: <OrderStatus status={order.status} />
    </p>
  );
}

OrderMeta.propTypes = {
  order: orderShape.isRequired,
};
