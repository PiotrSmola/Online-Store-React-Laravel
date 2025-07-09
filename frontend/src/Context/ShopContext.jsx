import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from 'prop-types';

export const ShopContext = createContext();

export default function ShopProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [customerToken, setCustomerToken] = useState(localStorage.getItem("customerToken"));
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  async function getCustomer() {
    if (!customerToken) return;

    try {
      const res = await fetch("http://localhost:8000/api/customer/me", {
        headers: {
          Authorization: `Bearer ${customerToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      } else {
        console.error('Customer fetch failed:', res.status, res.statusText);
        setCustomerToken(null);
        setCustomer(null);
        localStorage.removeItem("customerToken");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  }

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch("http://localhost:8000/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }

  const addToCart = (product, selectedSize = null, selectedColor = null, quantity = 1) => {
    const cartKey = `${product.id}-${selectedSize || 'none'}-${selectedColor || 'none'}`;
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => 
        item.product.id === product.id && 
        item.selectedSize === selectedSize && 
        item.selectedColor === selectedColor
      );

      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && 
          item.selectedSize === selectedSize && 
          item.selectedColor === selectedColor
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prevCart, { 
        id: cartKey,
        product, 
        selectedSize, 
        selectedColor, 
        quantity 
      }];
    });
  };

  const removeFromCart = (cartItemId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== cartItemId));
  };

  const updateCartQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCart(prevCart => 
      prevCart.map(item =>
        item.id === cartItemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("cart");
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (parseFloat(item.product.cena) * item.quantity), 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const loginCustomer = (customerData, token) => {
    setCustomer(customerData);
    setCustomerToken(token);
    localStorage.setItem("customerToken", token);
  };

  const logoutCustomer = async () => {
    if (customerToken) {
      try {
        await fetch("http://localhost:8000/api/customer/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${customerToken}`,
            Accept: 'application/json',
          },
        });
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }

    setCustomer(null);
    setCustomerToken(null);
    localStorage.removeItem("customerToken");
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    if (customerToken) {
      getCustomer();
    }
  }, [customerToken]);

  const value = {
    customer,
    customerToken,
    loginCustomer,
    logoutCustomer,
    
    products,
    categories,
    loading,
    fetchProducts,
    
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    getCartTotal,
    getCartItemsCount,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}

ShopProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}