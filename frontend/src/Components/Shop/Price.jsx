import PropTypes from 'prop-types';
import { formatPrice } from '../../lib/format';

/** What a buyer pays, with the regular price struck through and announced during a sale. */
export default function Price({ product, className = '' }) {
  if (!product.is_on_sale) {
    return <span className={`font-semibold ${className}`}>{formatPrice(product.effective_price)}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="font-semibold">
        <span className="sr-only">Cena promocyjna: </span>
        {formatPrice(product.effective_price)}
      </span>
      <s className="text-stone">
        <span className="sr-only">Poprzednia cena: </span>
        {formatPrice(product.cena)}
      </s>
    </span>
  );
}

Price.propTypes = {
  product: PropTypes.shape({
    is_on_sale: PropTypes.bool,
    effective_price: PropTypes.string,
    cena: PropTypes.string,
  }).isRequired,
  className: PropTypes.string,
};
