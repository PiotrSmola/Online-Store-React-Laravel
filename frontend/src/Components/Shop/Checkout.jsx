import { useState } from 'react';
import { Navigate } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth, useCartItems } from '../../Context/useShop';
import { usePageTitle } from '../../hooks/usePageTitle';
import Spinner from '../ui/Spinner';
import AuthCheckFailed from './AuthCheckFailed';
import CheckoutForm from './CheckoutForm';

export default function Checkout() {
  const items = useCartItems();
  const { status, customer } = useAuth();
  const [placed, setPlaced] = useState(false);

  usePageTitle('Zamówienie');

  // A placed order empties the cart just before the route changes: stay here, not on the cart page.
  if (placed) return <Spinner label="Składamy zamówienie" />;
  if (items.length === 0) return <Navigate to="/cart" replace />;
  if (status === AUTH_STATUS.loading) return <Spinner />;
  if (status === AUTH_STATUS.unknown) return <AuthCheckFailed />;

  return <CheckoutForm key={customer?.id ?? 'guest'} customer={customer} onPlaced={() => setPlaced(true)} />;
}
