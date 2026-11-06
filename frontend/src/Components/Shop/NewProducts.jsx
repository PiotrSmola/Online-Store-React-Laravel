import CatalogView from './CatalogView';

const SCOPE = { is_new: 1 };

export default function NewProducts() {
  return <CatalogView title="Nowości" scope={SCOPE} emptyText="Nie ma teraz nowości" />;
}
