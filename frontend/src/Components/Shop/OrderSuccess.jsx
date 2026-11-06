import { useLocation } from 'react-router';
import { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import { OrderFacts, OrderItems, OrderMeta, OrderTotals } from './OrderParts';

export default function OrderSuccess() {
  const { state } = useLocation();
  const order = state?.order;

  if (!order) {
    return (
      <div className="gutter">
        <EmptyState
          isPage
          title="Nie znaleziono informacji o zamówieniu"
          text="Złożone zamówienia znajdziesz na swoim koncie."
          action={<ButtonLink to="/orders">Moje zamówienia</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Zamówienie zostało złożone</PageHeading>
      <p className="mt-3 text-xl">Numer zamówienia: {order.order_number}</p>
      <OrderMeta order={order} />

      <div className="mt-10">
        <OrderFacts order={order} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <OrderItems items={order.items} />
        <div className="lg:self-start">
          <OrderTotals order={order} />
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink to="/orders">Moje zamówienia</ButtonLink>
        <ButtonLink to="/products" variant="secondary">
          Kontynuuj zakupy
        </ButtonLink>
      </div>
    </div>
  );
}
