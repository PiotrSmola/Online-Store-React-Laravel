import { useAuth } from '../../Context/useShop';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';

/** The stored token could not be checked, so neither the signed-in nor the guest view is safe. */
export default function AuthCheckFailed() {
  const { retry } = useAuth();

  return (
    <div className="gutter">
      <EmptyState
        isPage
        title="Nie udało się sprawdzić logowania"
        text="Sprawdź połączenie i spróbuj ponownie."
        action={<Button onClick={retry}>Spróbuj ponownie</Button>}
      />
    </div>
  );
}
