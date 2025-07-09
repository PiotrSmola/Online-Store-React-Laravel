import { Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function Cart() {
  const { cart, removeFromCart, updateCartQuantity, getCartTotal, clearCart } = useShop();

  if (cart.length === 0) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <h2>Twój koszyk jest pusty</h2>
        <p>
          <Link to="/" className="w3-button w3-black w3-padding-large">
            Kontynuuj zakupy
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w3-container w3-padding-32">
      <h1>Koszyk</h1>
      
      <div className="w3-responsive">
        <table className="w3-table w3-striped w3-border">
          <thead>
            <tr className="w3-light-grey">
              <th>Produkt</th>
              <th>Rozmiar</th>
              <th>Kolor</th>
              <th>Cena</th>
              <th>Ilość</th>
              <th>Suma</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="w3-row">
                    <div className="w3-col" style={{ width: "110px" }}>
                      <img 
                        src={item.product.images?.[0] ? `http://localhost:8000/storage/products/${item.product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                        alt={item.product.nazwa}
                        className="cart-thumbnail"
                      />
                    </div>
                    <div className="w3-col s6">
                      <Link to={`/product/${item.product.id}`} className="product-link">
                        {item.product.nazwa}
                      </Link>
                    </div>
                  </div>
                </td>
                <td>{item.selectedSize || '-'}</td>
                <td>{item.selectedColor || '-'}</td>
                <td>{parseFloat(item.product.cena).toFixed(2)} zł</td>
                <td>
                  <input 
                    type="number" 
                    min="1" 
                    value={item.quantity}
                    onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value) || 1)}
                    className="w3-input w3-border"
                    style={{ width: "60px" }}
                  />
                </td>
                <td>{(parseFloat(item.product.cena) * item.quantity).toFixed(2)} zł</td>
                <td>
                  <button 
                    className="w3-button w3-red w3-small"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="w3-row w3-margin-top">
        <div className="w3-col s6">
          <button 
            className="w3-button w3-light-grey"
            onClick={clearCart}
          >
            Wyczyść koszyk
          </button>
        </div>
        <div className="w3-col s6 w3-right-align">
          <h3>Suma: {getCartTotal().toFixed(2)} zł</h3>
          <Link 
            to="/checkout" 
            className="w3-button w3-green w3-padding-large"
          >
            Przejdź do zamówienia
          </Link>
        </div>
      </div>
    </div>
  );
}