import { NavLink, Route, Routes } from 'react-router';
import { useAuth } from '../../Context/useShop';
import { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import AdminCoupons, { AdminCouponForm } from './AdminCoupons';
import AdminCustomers from './AdminCustomers';
import AdminMessages from './AdminMessages';
import AdminNewsletter from './AdminNewsletter';
import AdminOrder from './AdminOrder';
import AdminOrders from './AdminOrders';
import AdminOverview from './AdminOverview';
import AdminProductForm from './AdminProductForm';
import AdminProducts from './AdminProducts';

const LINKS = [
  { to: '/admin', label: 'Przegląd', end: true },
  { to: '/admin/products', label: 'Produkty' },
  { to: '/admin/orders', label: 'Zamówienia' },
  { to: '/admin/customers', label: 'Klienci' },
  { to: '/admin/coupons', label: 'Kupony' },
  { to: '/admin/messages', label: 'Wiadomości' },
  { to: '/admin/newsletter', label: 'Newsletter' },
];

function linkClass({ isActive }) {
  const base = 'inline-flex h-11 items-center rounded-control underline-offset-8 hover:text-pine hover:underline';
  return `${base} ${isActive ? 'font-semibold text-pine underline' : ''}`;
}

/**
 * The admin panel, in its own chunk that shoppers never download. RequireAuth has already waited
 * for the session; this check is for the interface only, because the API enforces access.
 */
export default function AdminApp() {
  const { customer } = useAuth();

  if (!customer?.is_admin) {
    return (
      <div className="gutter">
        <EmptyState
          isPage
          title="Brak dostępu"
          text="Ta część sklepu jest tylko dla administratorów."
          action={<ButtonLink to="/">Wróć do sklepu</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="gutter py-6 lg:py-8">
      <nav aria-label="Panel administracyjny" className="mb-6">
        <ul className="flex flex-wrap gap-x-5">
          {LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={linkClass}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id" element={<AdminProductForm />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrder />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="coupons/new" element={<AdminCouponForm />} />
        <Route path="coupons/:id" element={<AdminCouponForm />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="newsletter" element={<AdminNewsletter />} />
        <Route
          path="*"
          element={
            <EmptyState
              isPage
              title="Nie znaleźliśmy tej strony panelu"
              action={<ButtonLink to="/admin">Wróć do przeglądu</ButtonLink>}
            />
          }
        />
      </Routes>
    </div>
  );
}
