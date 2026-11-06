import PropTypes from 'prop-types';
import { countProducts } from '../../lib/format';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';

/** A titled product list, shared by all products and by a single category. */
export default function CatalogView({ title, resource, emptyText }) {
  const { data, error, loading, reload } = resource;

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading className="text-5xl lg:text-7xl">{title}</PageHeading>
      <p role="status" className="mt-2 mb-8 min-h-6 text-stone">
        {data ? countProducts(data.total) : ''}
      </p>

      {loading && <ProductGridSkeleton />}

      {error && (
        <EmptyState
          title="Nie udało się wczytać produktów"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState title={emptyText} action={<ButtonLink to="/products">Zobacz wszystkie produkty</ButtonLink>} />
      )}

      {data && data.items.length > 0 && <ProductGrid products={data.items} prioritizeFirstRow />}
    </div>
  );
}

CatalogView.propTypes = {
  title: PropTypes.string.isRequired,
  resource: PropTypes.shape({
    data: PropTypes.object,
    error: PropTypes.object,
    loading: PropTypes.bool.isRequired,
    reload: PropTypes.func.isRequired,
  }).isRequired,
  emptyText: PropTypes.string.isRequired,
};
