import CatalogView from './CatalogView';

const SCOPE = { on_sale: 1 };

export default function SaleProducts() {
  return <CatalogView title="Wyprzedaż" scope={SCOPE} emptyText="Nie ma teraz produktów na wyprzedaży" />;
}
