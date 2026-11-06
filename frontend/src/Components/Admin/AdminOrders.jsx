import { Link } from 'react-router';
import { usePagedList } from '../../hooks/usePagedList';
import { getAdminOrders } from '../../lib/admin';
import { formatDate, formatPrice } from '../../lib/format';
import PageHeading from '../ui/PageHeading';
import Select from '../ui/Select';
import { OrderStatus, PaymentStatus } from '../Shop/OrderParts';
import { LINK, ListBody, SearchBox, TD, TH, TableRegion } from './AdminParts';

const STATUS_OPTIONS = [
  { value: '', label: 'Wszystkie' },
  { value: 'pending', label: 'Oczekujące' },
  { value: 'processing', label: 'W realizacji' },
  { value: 'shipped', label: 'Wysłane' },
  { value: 'delivered', label: 'Dostarczone' },
  { value: 'cancelled', label: 'Anulowane' },
];

export default function AdminOrders() {
  const list = usePagedList(getAdminOrders);

  return (
    <>
      <PageHeading>Zamówienia</PageHeading>

      <div className="my-6 flex flex-wrap items-end gap-4">
        <SearchBox label="Numer, e-mail lub nazwisko" value={list.query.q ?? ''} onChange={(q) => list.setQuery({ q })} />
        <Select
          className="w-48"
          label="Status"
          options={STATUS_OPTIONS}
          value={list.query.status ?? ''}
          onChange={(event) => list.setQuery({ status: event.target.value })}
        />
      </div>

      <ListBody list={list} emptyTitle="Nie znaleźliśmy zamówień">
        <TableRegion label="Lista zamówień">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Numer
              </th>
              <th scope="col" className={TH}>
                Data
              </th>
              <th scope="col" className={TH}>
                Klient
              </th>
              <th scope="col" className={TH}>
                Kwota
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                Płatność
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((order) => (
              <tr key={order.id}>
                <td className={TD}>
                  <Link to={`/admin/orders/${order.id}`} className={LINK}>
                    {order.order_number}
                  </Link>
                </td>
                <td className={TD}>{formatDate(order.order_date)}</td>
                <td className={TD}>
                  <p>
                    {order.customer?.first_name} {order.customer?.last_name}
                  </p>
                  <p className="text-sm text-stone">{order.customer?.email}</p>
                </td>
                <td className={TD}>{formatPrice(order.total_amount)}</td>
                <td className={TD}>
                  <OrderStatus order={order} />
                </td>
                <td className={TD}>
                  <PaymentStatus order={order} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableRegion>
      </ListBody>
    </>
  );
}
