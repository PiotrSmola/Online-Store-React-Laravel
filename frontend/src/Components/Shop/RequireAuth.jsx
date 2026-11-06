import { Navigate, Outlet, useLocation } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { loginPath } from '../../lib/redirect';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';

/** Guards its child routes, and waits for the stored token's check before it decides. */
export default function RequireAuth() {
  const { status, retry } = useAuth();
  const { pathname, search } = useLocation();

  if (status === AUTH_STATUS.authenticated) return <Outlet />;
  if (status === AUTH_STATUS.loading) return <Spinner label="Sprawdzamy logowanie" />;
  if (status === AUTH_STATUS.guest) return <Navigate to={loginPath(`${pathname}${search}`)} replace />;

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
