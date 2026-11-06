import { useProducts } from '../../hooks/useCatalog';
import CatalogView from './CatalogView';

export default function ProductList() {
  const products = useProducts();

  return <CatalogView title="Wszystkie produkty" resource={products} emptyText="Nie ma jeszcze żadnych produktów" />;
}
