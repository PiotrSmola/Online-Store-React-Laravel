import { useParams } from 'react-router';
import { useOrder } from '../../hooks/useOrders';
import { usePageTitle } from '../../hooks/usePageTitle';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Skeleton from '../ui/Skeleton';
import { OrderFacts, OrderItems, OrderMeta, OrderTotals } from './OrderParts';

function OrderView({ order }) {
  return (
    <>
      <PageHeading documentTitle={`Zamówienie ${order.order_number}`}>{`Zamówienie ${order.order_number}`}</PageHeading>
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
    </>
  );
}

OrderView.propTypes = OrderTotals.propTypes;

export default function OrderDetail() {
  const { id } = useParams();
  const { data: order, error, loading, reload } = useOrder(id);
  const isMissing = error?.status === 403 || error?.status === 404;

  usePageTitle(loading ? 'Zamówienie' : null);

  return (
    <div className="gutter py-8 lg:py-12">
      {loading && (
        <>
          <Skeleton className="h-12 max-w-xl" />
          <Skeleton className="mt-2 h-6 max-w-xs" />
          <Skeleton className="mt-10 h-48" />
        </>
      )}
      {order && <OrderView order={order} />}
      {isMissing && (
        <EmptyState
          isPage
          title="Nie znaleziono zamówienia"
          action={<ButtonLink to="/orders">Moje zamówienia</ButtonLink>}
        />
      )}
      {error && !isMissing && (
        <EmptyState
          isPage
          title="Nie udało się wczytać zamówienia"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}
    </div>
  );
}
