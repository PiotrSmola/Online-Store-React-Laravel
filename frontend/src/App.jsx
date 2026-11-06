import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import ShopProvider from './Context/ShopContext';
import ToastProvider from './Context/ToastContext';
import ShopLayout from './Components/Shop/Layout';
import RequireAuth from './Components/Shop/RequireAuth';

const Home = lazy(() => import('./Components/Shop/Home'));
const ProductList = lazy(() => import('./Components/Shop/ProductList'));
const CategoryProducts = lazy(() => import('./Components/Shop/CategoryProducts'));
const ProductDetail = lazy(() => import('./Components/Shop/ProductDetail'));
const Cart = lazy(() => import('./Components/Shop/Cart'));
const Checkout = lazy(() => import('./Components/Shop/Checkout'));
const CustomerLogin = lazy(() => import('./Components/Shop/CustomerLogin'));
const OrderSuccess = lazy(() => import('./Components/Shop/OrderSuccess'));
const CustomerOrders = lazy(() => import('./Components/Shop/CustomerOrders'));
const OrderDetail = lazy(() => import('./Components/Shop/OrderDetail'));
const NotFound = lazy(() => import('./Components/Shop/NotFound'));

export default function App() {
  return (
    <ToastProvider>
      <ShopProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ShopLayout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<ProductList />} />
              <Route path="product/:id" element={<ProductDetail />} />
              <Route path="category/:category" element={<CategoryProducts />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="login" element={<CustomerLogin />} />
              <Route path="order-success" element={<OrderSuccess />} />
              <Route element={<RequireAuth />}>
                <Route path="orders" element={<CustomerOrders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ShopProvider>
    </ToastProvider>
  );
}
