import { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';

export default function NotFound() {
  return (
    <div className="gutter">
      <EmptyState
        isPage
        title="Nie znaleźliśmy tej strony"
        text="Adres mógł się zmienić albo zawierać literówkę."
        action={<ButtonLink to="/">Wróć do sklepu</ButtonLink>}
      />
    </div>
  );
}
