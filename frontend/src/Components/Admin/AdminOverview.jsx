import { useCallback } from 'react';
import { Link } from 'react-router';
import { useResource } from '../../hooks/useResource';
import { getStats } from '../../lib/admin';
import { formatPrice } from '../../lib/format';
import { optionsText } from '../../lib/product';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Spinner from '../ui/Spinner';
import { LINK, TD, TH, TableRegion } from './AdminParts';

const STATUS_LABELS = [
  ['pending', 'Oczekujące'],
  ['processing', 'W realizacji'],
  ['shipped', 'Wysłane'],
  ['delivered', 'Dostarczone'],
  ['cancelled', 'Anulowane'],
];

export default function AdminOverview() {
  const load = useCallback((signal) => getStats({ signal }), []);
  const { data: stats, error, loading, reload } = useResource(load, 'admin-stats');

  return (
    <>
      <PageHeading documentTitle="Panel administracyjny">Przegląd</PageHeading>

      {loading && <Spinner />}

      {error && (
        <EmptyState
          title="Nie udało się wczytać przeglądu"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}

      {stats && (
        <>
          <dl className="mt-6 grid max-w-3xl gap-x-12 gap-y-3 sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt>Przychód</dt>
              <dd className="font-semibold">{formatPrice(stats.revenue)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Zamówienia</dt>
              <dd className="font-semibold">{stats.orders_count}</dd>
            </div>
            {STATUS_LABELS.map(([status, label]) => (
              <div key={status} className="flex justify-between gap-4">
                <dt>
                  <Link to={`/admin/orders?status=${status}`} className={LINK}>
                    {label}
                  </Link>
                </dt>
                <dd>{stats.orders_by_status?.[status] ?? 0}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt>
                <Link to="/admin/messages?unread=1" className={LINK}>
                  Nieprzeczytane wiadomości
                </Link>
              </dt>
              <dd className="font-semibold">{stats.unread_messages}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>
                <Link to="/admin/newsletter" className={LINK}>
                  Potwierdzeni subskrybenci
                </Link>
              </dt>
              <dd className="font-semibold">{stats.confirmed_subscribers}</dd>
            </div>
          </dl>

          <section aria-labelledby="low-stock" className="mt-12">
            <h2 id="low-stock" className="mb-1 text-2xl">
              Niski stan magazynowy
            </h2>
            <p className="mb-4 text-stone">Warianty poniżej 3 sztuk: {stats.low_stock_count}</p>

            {stats.low_stock.length > 0 && (
              <TableRegion label="Warianty z niskim stanem">
                <thead>
                  <tr>
                    <th scope="col" className={TH}>
                      Produkt
                    </th>
                    <th scope="col" className={TH}>
                      Wariant
                    </th>
                    <th scope="col" className={TH}>
                      Stan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.low_stock.map((variant) => (
                    <tr key={variant.id}>
                      <td className={TD}>
                        <Link to={`/admin/products/${variant.product_id}`} className={LINK}>
                          {variant.product?.nazwa}
                        </Link>
                      </td>
                      <td className={TD}>{optionsText(variant.size, variant.color)}</td>
                      <td className={`${TD} ${variant.stock === 0 ? 'font-semibold text-ember' : ''}`}>{variant.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </TableRegion>
            )}
          </section>
        </>
      )}
    </>
  );
}
