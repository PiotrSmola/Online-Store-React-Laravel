import { useState } from 'react';
import { Link } from 'react-router';
import { useToast } from '../../Context/useToast';
import { usePagedList } from '../../hooks/usePagedList';
import { deleteProduct, getAdminProducts } from '../../lib/admin';
import { formatPrice } from '../../lib/format';
import Button, { ButtonLink } from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeading from '../ui/PageHeading';
import { LINK, ListBody, SearchBox, TD, TH, TableRegion } from './AdminParts';

export default function AdminProducts() {
  const list = usePagedList(getAdminProducts);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();

  const handleDelete = async () => {
    const product = deleting;
    setDeleting(null);

    try {
      const result = await deleteProduct(product.id);
      if (result.deleted) toast.success(result.message);
      else toast.error(result.message);
      list.reload();
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeading>Produkty</PageHeading>
        <ButtonLink to="/admin/products/new">Dodaj produkt</ButtonLink>
      </div>

      <div className="my-6">
        <SearchBox label="Nazwa lub kategoria" value={list.query.q ?? ''} onChange={(q) => list.setQuery({ q })} />
      </div>

      <ListBody list={list} emptyTitle="Nie znaleźliśmy produktów">
        <TableRegion label="Lista produktów">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Nazwa
              </th>
              <th scope="col" className={TH}>
                Kategoria
              </th>
              <th scope="col" className={TH}>
                Cena
              </th>
              <th scope="col" className={TH}>
                Stan
              </th>
              <th scope="col" className={TH}>
                Widoczność
              </th>
              <th scope="col" className={TH}>
                <span className="sr-only">Działania</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((product) => (
              <tr key={product.id}>
                <td className={TD}>
                  <Link to={`/admin/products/${product.id}`} className={LINK}>
                    {product.nazwa}
                  </Link>
                </td>
                <td className={TD}>{product.kategoria}</td>
                <td className={TD}>{formatPrice(product.effective_price)}</td>
                <td className={TD}>{product.stock_total}</td>
                <td className={TD}>{product.is_active ? 'Widoczny' : 'Ukryty'}</td>
                <td className={TD}>
                  <Button variant="plain" aria-label={`Usuń: ${product.nazwa}`} onClick={() => setDeleting(product)}>
                    Usuń
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableRegion>
      </ListBody>

      <ConfirmDialog
        open={deleting !== null}
        title="Usunąć produkt?"
        text={`${deleting?.nazwa ?? ''}. Produkt z zamówieniami zostanie tylko ukryty.`}
        confirmLabel="Usuń produkt"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
