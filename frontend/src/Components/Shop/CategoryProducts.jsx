import { useParams } from 'react-router';
import CatalogView from './CatalogView';

export default function CategoryProducts() {
  const { category } = useParams();

  return (
    <CatalogView
      key={category}
      title={category}
      scope={{ category }}
      emptyText="W tej kategorii nie ma jeszcze produktów"
    />
  );
}
