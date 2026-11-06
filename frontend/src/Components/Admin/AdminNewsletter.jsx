import { useState } from 'react';
import { useToast } from '../../Context/useToast';
import { usePagedList } from '../../hooks/usePagedList';
import { exportSubscribers, getSubscribers } from '../../lib/admin';
import { saveFile } from '../../lib/api';
import { formatDate } from '../../lib/format';
import Button from '../ui/Button';
import PageHeading from '../ui/PageHeading';
import { ListBody, SearchBox, TD, TH, TableRegion } from './AdminParts';

export default function AdminNewsletter() {
  const list = usePagedList(getSubscribers);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const handleExport = async () => {
    setExporting(true);

    try {
      saveFile(await exportSubscribers());
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading>Newsletter</PageHeading>
        <Button variant="secondary" loading={exporting} onClick={handleExport}>
          Pobierz CSV
        </Button>
      </div>

      <div className="my-6">
        <SearchBox label="Szukaj adresu" value={list.query.q ?? ''} onChange={(q) => list.setQuery({ q })} />
      </div>

      <ListBody list={list} emptyTitle="Nie ma jeszcze subskrybentów">
        <TableRegion label="Lista subskrybentów">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                E-mail
              </th>
              <th scope="col" className={TH}>
                Stan
              </th>
              <th scope="col" className={TH}>
                Zapis
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((subscriber) => (
              <tr key={subscriber.id}>
                <td className={TD}>{subscriber.email}</td>
                <td className={`${TD} ${subscriber.confirmed_at ? 'text-pine' : 'text-stone'}`}>
                  {subscriber.confirmed_at ? 'Potwierdzony' : 'Czeka na potwierdzenie'}
                </td>
                <td className={TD}>{formatDate(subscriber.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableRegion>
      </ListBody>
    </>
  );
}
