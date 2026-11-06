import PropTypes from 'prop-types';

/** Plain text beside the price, in place of a badge. */
export default function ProductLabel({ product }) {
  const labels = [product.is_new && 'Nowość', product.is_on_sale && `Wyprzedaż -${product.discount_percent}%`].filter(Boolean);

  if (product.stock_total === 0) return <span className="block text-sm text-ember">Wyprzedane</span>;
  if (labels.length === 0) return null;

  return <span className="block text-sm text-pine">{labels.join(', ')}</span>;
}

ProductLabel.propTypes = {
  product: PropTypes.shape({
    is_new: PropTypes.bool,
    is_on_sale: PropTypes.bool,
    discount_percent: PropTypes.number,
    stock_total: PropTypes.number,
  }).isRequired,
};
