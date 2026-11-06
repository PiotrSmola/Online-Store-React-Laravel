import { Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { useCartCount } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useCategories } from '../../hooks/useCatalog';
import { onUnauthorized } from '../../lib/api';
import { countProducts } from '../../lib/format';
import { loginPath } from '../../lib/redirect';
import Spinner from '../ui/Spinner';
import ErrorBoundary from './ErrorBoundary';
import Footer from './Footer';
import Header from './Header';

const NO_CATEGORIES = [];

function CartCountAnnouncer() {
  const count = useCartCount();

  return (
    <p aria-live="polite" className="sr-only">
      {`W koszyku: ${countProducts(count)}`}
    </p>
  );
}

export default function ShopLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const toast = useToast();
  const categories = useCategories();
  const categoryNames = categories.data ?? NO_CATEGORIES;

  // The back and forward buttons keep the browser's own scroll position.
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  useEffect(
    () =>
      onUnauthorized(() => {
        toast.error('Sesja wygasła. Zaloguj się ponownie.');
        navigate(loginPath(`${window.location.pathname}${window.location.search}`), { replace: true });
      }),
    [navigate, toast],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-control focus:bg-pine focus:px-4 focus:py-3 focus:text-white"
      >
        Przejdź do treści
      </a>

      <Header categories={categoryNames} />

      <main id="main" tabIndex={-1} className="min-h-dvh grow outline-none">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Spinner />}>
            <Outlet context={categories} />
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer categories={categoryNames} />
      <CartCountAnnouncer />
    </div>
  );
}
