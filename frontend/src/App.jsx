import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import ShopProvider from './Context/ShopContext';
import ToastProvider from './Context/ToastContext';
import Home from './Components/Shop/Home';
import ShopLayout from './Components/Shop/Layout';
import RequireAuth from './Components/Shop/RequireAuth';

const ProductList = lazy(() => import('./Components/Shop/ProductList'));
const NewProducts = lazy(() => import('./Components/Shop/NewProducts'));
const SaleProducts = lazy(() => import('./Components/Shop/SaleProducts'));
const CategoryProducts = lazy(() => import('./Components/Shop/CategoryProducts'));
const ProductDetail = lazy(() => import('./Components/Shop/ProductDetail'));
const Cart = lazy(() => import('./Components/Shop/Cart'));
const Checkout = lazy(() => import('./Components/Shop/Checkout'));
const CustomerLogin = lazy(() => import('./Components/Shop/CustomerLogin'));
const Register = lazy(() => import('./Components/Shop/Register'));
const ForgotPassword = lazy(() => import('./Components/Shop/ForgotPassword'));
const ResetPassword = lazy(() => import('./Components/Shop/ResetPassword'));
const Account = lazy(() => import('./Components/Shop/Account'));
const Wishlist = lazy(() => import('./Components/Shop/Wishlist'));
const OrderSuccess = lazy(() => import('./Components/Shop/OrderSuccess'));
const CustomerOrders = lazy(() => import('./Components/Shop/CustomerOrders'));
const OrderDetail = lazy(() => import('./Components/Shop/OrderDetail'));
const PaymentPage = lazy(() => import('./Components/Shop/PaymentPage'));
const Contact = lazy(() => import('./Components/Shop/Contact'));
const NewsletterConfirm = lazy(() =>
  import('./Components/Shop/NewsletterAction').then((module) => ({ default: module.NewsletterConfirm })),
);
const NewsletterUnsubscribe = lazy(() =>
  import('./Components/Shop/NewsletterAction').then((module) => ({ default: module.NewsletterUnsubscribe })),
);
const NotFound = lazy(() => import('./Components/Shop/NotFound'));
// The admin panel is one chunk, which only this route ever requests.
const AdminApp = lazy(() => import('./Components/Admin/AdminApp'));

export default function App() {
  return (
    <ToastProvider>
      <ShopProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ShopLayout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<ProductList />} />
              <Route path="new" element={<NewProducts />} />
              <Route path="sale" element={<SaleProducts />} />
              <Route path="product/:id" element={<ProductDetail />} />
              <Route path="category/:category" element={<CategoryProducts />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="login" element={<CustomerLogin />} />
              <Route path="register" element={<Register />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="order-success" element={<OrderSuccess />} />
              <Route path="contact" element={<Contact />} />
              <Route path="newsletter/confirm" element={<NewsletterConfirm />} />
              <Route path="newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
              <Route element={<RequireAuth />}>
                <Route path="account" element={<Account />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="orders" element={<CustomerOrders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="orders/:id/pay" element={<PaymentPage />} />
                <Route path="admin/*" element={<AdminApp />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ShopProvider>
    </ToastProvider>
  );
}
