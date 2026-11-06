import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { useCartActions } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { productHasOptions } from '../../lib/product';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import Price from './Price';
import ProductImage from './ProductImage';
import ProductLabel from './ProductLabel';

const GRID = 'grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
const FIRST_ROW = 4;

function ProductTile({ product, priority, action }) {
  const { addItem } = useCartActions();
  const toast = useToast();
  const canAddHere = !productHasOptions(product) && product.stock_total > 0;

  // A product with a size or color can only be ordered from its page, after choosing one.
  const handleAdd = () => {
    addItem({ product_id: product.id });
    toast.success(`Dodano do koszyka: ${product.nazwa}`);
  };

  return (
    <li>
      <Link to={`/product/${product.id}`} className="group block">
        <ProductImage image={product.images?.[0]} alt="" thumbnail priority={priority} />
        <span className="mt-2 block group-hover:underline">{product.nazwa}</span>
        <ProductLabel product={product} />
        <Price product={product} />
      </Link>
      {canAddHere && (
        <Button variant="plain" onClick={handleAdd} aria-label={`Dodaj do koszyka: ${product.nazwa}`}>
          Dodaj do koszyka
        </Button>
      )}
      {action?.(product)}
    </li>
  );
}

ProductTile.propTypes = {
  product: PropTypes.object.isRequired,
  priority: PropTypes.string.isRequired,
  action: PropTypes.func,
};

function tilePriority(index) {
  if (index === 0) return 'high';
  return index < FIRST_ROW ? 'eager' : 'lazy';
}

/**
 * prioritizeFirstRow is only for a grid at the top of a page, where a tile can be the LCP image.
 * action(product) adds a control under a tile.
 */
export default function ProductGrid({ products, prioritizeFirstRow = false, action }) {
  return (
    <ul className={GRID}>
      {products.map((product, index) => (
        <ProductTile
          key={product.id}
          product={product}
          priority={prioritizeFirstRow ? tilePriority(index) : 'lazy'}
          action={action}
        />
      ))}
    </ul>
  );
}

ProductGrid.propTypes = {
  products: PropTypes.arrayOf(PropTypes.object).isRequired,
  prioritizeFirstRow: PropTypes.bool,
  action: PropTypes.func,
};

/** Keeps the space of the final grid, so nothing moves when products arrive. */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[3/4] w-full" />
          <div className="mt-2 h-6 w-3/4" />
          <div className="h-6 w-1/4" />
        </div>
      ))}
    </div>
  );
}

ProductGridSkeleton.propTypes = {
  count: PropTypes.number,
};
