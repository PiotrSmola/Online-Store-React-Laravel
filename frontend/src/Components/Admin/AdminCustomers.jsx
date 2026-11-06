import { usePagedList } from '../../hooks/usePagedList';
import { getCustomers } from '../../lib/admin';
import { formatDate } from '../../lib/format';
import PageHeading from '../ui/PageHeading';
import { ListBody, SearchBox, TD, TH, TableRegion } from './AdminParts';

export default function AdminCustomers() {
  const list = usePagedList(getCustomers);

  return (
    <>
      <PageHeading>Klienci</PageHeading>

      <div className="my-6">
        <SearchBox label="E-mail lub nazwisko" value={list.query.q ?? ''} onChange={(q) => list.setQuery({ q })} />
      </div>

      <ListBody list={list} emptyTitle="Nie znaleźliśmy klientów">
        <TableRegion label="Lista klientów">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Klient
              </th>
              <th scope="col" className={TH}>
                E-mail
              </th>
              <th scope="col" className={TH}>
                Miasto
              </th>
              <th scope="col" className={TH}>
                Typ
              </th>
              <th scope="col" className={TH}>
                Zamówienia
              </th>
              <th scope="col" className={TH}>
                Konto od
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((customer) => (
              <tr key={customer.id}>
                <td className={TD}>
                  {customer.first_name} {customer.last_name}
                  {customer.is_admin && <span className="block text-sm text-pine">Administrator</span>}
                </td>
                <td className={TD}>{customer.email}</td>
                <td className={TD}>{customer.city}</td>
                <td className={TD}>{customer.customer_type === 'company' ? customer.company_name || 'Firma' : 'Indywidualny'}</td>
                <td className={TD}>{customer.orders_count}</td>
                <td className={TD}>{formatDate(customer.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableRegion>
      </ListBody>
    </>
  );
}
