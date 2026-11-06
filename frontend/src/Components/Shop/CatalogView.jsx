import { startTransition, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useSearchParams } from 'react-router';
import { useCatalogFilters, useProducts } from '../../hooks/useCatalog';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import { PER_PAGE, catalogPageHref, hasActiveFilters, nextCatalogSearch, readCatalogQuery } from '../../lib/catalogQuery';
import { countProducts } from '../../lib/format';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Pagination from '../ui/Pagination';
import CatalogFilters from './CatalogFilters';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';

function resultText(data, q) {
  const count = countProducts(data.total);
  return q ? `${count} dla „${q}”` : count;
}

/**
 * A product list with search, sort, filters and pages in its URL. scope holds what the page always
 * shows, such as one category or the sale. Give it a key per scope, so results never mix.
 */
export default function CatalogView({ title, scope = {}, emptyText }) {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readCatalogQuery(searchParams), [searchParams]);
  const { data, error, loading, reload } = useProducts({ ...scope, ...query, per_page: PER_PAGE });
  const filters = useCatalogFilters(scope.category);
  const focusHeading = useFocusPageHeading();

  const updateQuery = useCallback(
    (changes) => startTransition(() => setSearchParams(nextCatalogSearch(query, changes), { replace: true })),
    [query, setSearchParams],
  );

  const handlePageChange = () => {
    window.scrollTo(0, 0);
    focusHeading();
  };

  const clearFilters = () => updateQuery({ q: '', size: '', color: '', min_price: '', max_price: '' });

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading className="text-5xl lg:text-7xl">{title}</PageHeading>
      <p role="status" className="mt-2 mb-6 min-h-6 text-stone">
        {data ? resultText(data, query.q) : ''}
      </p>

      <CatalogFilters query={query} filters={filters.data} onChange={updateQuery} />

      {loading && !data && <ProductGridSkeleton count={12} />}

      {error && (
        <EmptyState
          title="Nie udało się wczytać produktów"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}

      {!error && data?.items.length === 0 && (
        <EmptyState
          title={hasActiveFilters(query) ? 'Nie znaleźliśmy takich produktów' : emptyText}
          action={
            hasActiveFilters(query) ? (
              <Button onClick={clearFilters}>Wyczyść filtry</Button>
            ) : (
              <ButtonLink to="/products">Zobacz wszystkie produkty</ButtonLink>
            )
          }
        />
      )}

      {!error && data?.items.length > 0 && (
        <div aria-busy={loading}>
          <ProductGrid products={data.items} prioritizeFirstRow />
          <div className="mt-10">
            <Pagination
              page={data.page}
              lastPage={data.lastPage}
              hrefFor={(page) => catalogPageHref(pathname, query, page)}
              onNavigate={handlePageChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

CatalogView.propTypes = {
  title: PropTypes.string.isRequired,
  scope: PropTypes.object,
  emptyText: PropTypes.string.isRequired,
};
