import { BrowserRouter, Routes, Route } from "react-router-dom";
import ShopProvider from "./Context/ShopContext";
import ShopLayout from "./Components/Shop/Layout";
import ProductList from "./Components/Shop/ProductList";
import ProductDetail from "./Components/Shop/ProductDetail";
import Cart from "./Components/Shop/Cart";
import Checkout from "./Components/Shop/Checkout";
import CustomerLogin from "./Components/Shop/CustomerLogin";
import OrderSuccess from "./Components/Shop/OrderSuccess";
import CategoryProducts from "./Components/Shop/CategoryProducts";
import CustomerOrders from "./Components/Shop/CustomerOrders";
import OrderDetail from "./Components/Shop/OrderDetail";
import "./App.css";

export default function App() {
  return (
    <ShopProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ShopLayout />}>
            <Route index element={<ProductList />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="category/:category" element={<CategoryProducts />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="login" element={<CustomerLogin />} />
            <Route path="order-success" element={<OrderSuccess />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ShopProvider>
  );
}