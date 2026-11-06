import { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { ShopDataContext } from '../../Context/useShopData';
import { useToast } from '../../Context/useToast';
import { useCategories, useShopConfig } from '../../hooks/useCatalog';
import { onUnauthorized } from '../../lib/api';
import { loginPath } from '../../lib/redirect';
import Spinner from '../ui/Spinner';
import ErrorBoundary from './ErrorBoundary';
import Footer from './Footer';
import Header from './Header';

export default function ShopLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const toast = useToast();
  const categories = useCategories();
  const config = useShopConfig();
  const shopData = useMemo(() => ({ categories, config }), [categories, config]);

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
    <ShopDataContext value={shopData}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-control focus:bg-pine focus:px-4 focus:py-3 focus:text-white"
        >
          Przejdź do treści
        </a>

        <Header />

        <main id="main" tabIndex={-1} className="min-h-dvh grow outline-none">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        <Footer />
      </div>
    </ShopDataContext>
  );
}
