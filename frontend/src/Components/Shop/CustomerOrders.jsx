import PropTypes from 'prop-types';
import { Link, useSearchParams } from 'react-router';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import { useOrders } from '../../hooks/useOrders';
import { countProducts, formatDate, formatPrice } from '../../lib/format';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Pagination from '../ui/Pagination';
import Skeleton from '../ui/Skeleton';
import { OrderStatus, PaymentStatus } from './OrderParts';

const ROW = 'grid gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]';

function OrderRow({ order }) {
  return (
    <li className={ROW}>
      <div>
        <h2 className="text-2xl">
          <Link to={`/orders/${order.id}`} className="underline-offset-4 hover:text-pine hover:underline">
            {order.order_number}
          </Link>
        </h2>
        <p className="text-stone">
          {formatDate(order.order_date)}, {countProducts(order.items.length)}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-xl font-semibold">{formatPrice(order.total)}</p>
        <p>
          <OrderStatus order={order} />
        </p>
        <p className="text-sm">
          <PaymentStatus order={order} />
        </p>
      </div>
    </li>
  );
}

OrderRow.propTypes = {
  order: PropTypes.object.isRequired,
};

function OrdersSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((row) => (
        <div key={row} className={ROW}>
          <Skeleton className="h-16 max-w-sm" />
          <Skeleton className="h-16 w-40" />
        </div>
      ))}
    </div>
  );
}

export default function CustomerOrders() {
  const [searchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const { data, error, loading, reload } = useOrders(page);
  const focusHeading = useFocusPageHeading();

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Moje zamówienia</PageHeading>

      <div className="mt-8 max-w-4xl">
        {loading && <OrdersSkeleton />}

        {error && (
          <EmptyState
            title="Nie udało się wczytać zamówień"
            text={error.message}
            action={<Button onClick={reload}>Spróbuj ponownie</Button>}
          />
        )}

        {data?.items.length === 0 && (
          <EmptyState
            title="Nie masz jeszcze zamówień"
            text="Gdy złożysz zamówienie, zobaczysz je tutaj."
            action={<ButtonLink to="/products">Zobacz produkty</ButtonLink>}
          />
        )}

        {data?.items.length > 0 && (
          <>
            <ul className="space-y-8">
              {data.items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
            <div className="mt-10">
              <Pagination
                page={data.page}
                lastPage={data.lastPage}
                hrefFor={(number) => (number > 1 ? `/orders?page=${number}` : '/orders')}
                onNavigate={focusHeading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
