import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useToast } from '../../Context/useToast';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import { useResource } from '../../hooks/useResource';
import { getWishlist, removeFromWishlist } from '../../lib/wishlist';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Pagination from '../ui/Pagination';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';

export default function Wishlist() {
  const [searchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const load = useCallback((signal) => getWishlist(page, { signal }), [page]);
  const { data, error, loading, reload } = useResource(load, `wishlist:${page}`, { keepPrevious: true });
  const [removed, setRemoved] = useState(() => new Set());
  const toast = useToast();
  const focusHeading = useFocusPageHeading();

  const items = (data?.items ?? []).filter((product) => !removed.has(product.id));

  const handleRemove = async (product) => {
    try {
      await removeFromWishlist(product.id);
      setRemoved((current) => new Set(current).add(product.id));
      toast.success(`Usunięto z listy życzeń: ${product.nazwa}`);
      focusHeading();
    } catch (requestError) {
      if (requestError.status !== 401) toast.error(requestError.message);
    }
  };

  const removeButton = (product) => (
    <Button variant="plain" aria-label={`Usuń z listy życzeń: ${product.nazwa}`} onClick={() => handleRemove(product)}>
      Usuń z listy
    </Button>
  );

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Lista życzeń</PageHeading>

      <div className="mt-8">
        {loading && !data && <ProductGridSkeleton count={4} />}

        {error && (
          <EmptyState
            title="Nie udało się wczytać listy życzeń"
            text={error.message}
            action={<Button onClick={reload}>Spróbuj ponownie</Button>}
          />
        )}

        {data && items.length === 0 && (
          <EmptyState
            title="Twoja lista życzeń jest pusta"
            text="Zapisuj tu produkty, do których chcesz wrócić."
            action={<ButtonLink to="/products">Zobacz produkty</ButtonLink>}
          />
        )}

        {items.length > 0 && (
          <>
            <ProductGrid products={items} prioritizeFirstRow action={removeButton} />
            <div className="mt-10">
              <Pagination
                page={data.page}
                lastPage={data.lastPage}
                hrefFor={(number) => (number > 1 ? `/wishlist?page=${number}` : '/wishlist')}
                onNavigate={focusHeading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
