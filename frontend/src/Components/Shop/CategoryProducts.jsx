import { useParams } from 'react-router';
import { useCategoryProducts } from '../../hooks/useCatalog';
import CatalogView from './CatalogView';

export default function CategoryProducts() {
  const { category } = useParams();
  const products = useCategoryProducts(category);

  return <CatalogView title={category} resource={products} emptyText="W tej kategorii nie ma jeszcze produktów" />;
}
