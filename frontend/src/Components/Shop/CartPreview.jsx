import { Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";
import PropTypes from 'prop-types';

export default function CartPreview({ isVisible, onMouseEnter, onMouseLeave }) {
  const { cart, removeFromCart, updateCartQuantity, getCartTotal } = useShop();

  if (!isVisible) return null;

  return (
    <div 
      className="cart-preview-dropdown"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="cart-preview-header">
        <h4 className="w3-margin-bottom">Koszyk ({cart.length})</h4>
      </div>
      
      {cart.length === 0 ? (
        <div className="cart-preview-empty">
          <p className="w3-text-grey w3-center w3-padding">
            <i className="fa fa-shopping-cart w3-large w3-text-grey"></i>
            <br />
            Koszyk jest pusty
          </p>
        </div>
      ) : (
        <>
          <div className="cart-preview-items">
            {cart.slice(0, 4).map((item) => (
              <div key={item.id} className="cart-preview-item w3-row w3-margin-bottom">
                <div className="w3-col" style={{ width: "60px" }}>
                  <img 
                    src={item.product.images?.[0] ? `http://localhost:8000/storage/products/${item.product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                    alt={item.product.nazwa}
                    className="cart-preview-image"
                  />
                </div>
                <div className="w3-col w3-padding-small" style={{ width: "calc(100% - 60px)" }}>
                  <div className="cart-preview-item-details">
                    <h6 className="w3-margin-bottom cart-preview-product-name">
                      {item.product.nazwa}
                    </h6>
                    
                    {(item.selectedSize || item.selectedColor) && (
                      <p className="w3-medium w3-text-grey w3-margin-bottom">
                        {item.selectedSize && <span>Rozmiar: {item.selectedSize}</span>}
                        {item.selectedSize && item.selectedColor && <span> | </span>}
                        {item.selectedColor && <span>Kolor: {item.selectedColor}</span>}
                      </p>
                    )}
                    
                    <div className="cart-preview-quantity-controls w3-row w3-margin-bottom">
                      <div className="w3-col s6">
                        <div className="quantity-control">
                          <button 
                            className="quantity-btn minus"
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <i className="fa fa-minus"></i>
                          </button>
                          <span className="quantity-display">{item.quantity}</span>
                          <button 
                            className="quantity-btn plus"
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          >
                            <i className="fa fa-plus"></i>
                          </button>
                        </div>
                      </div>
                      <div className="w3-col s6 w3-right-align">
                        <button 
                          className="remove-btn"
                          onClick={() => removeFromCart(item.id)}
                          title="Usuń z koszyka"
                        >
                          <i className="fa fa-trash w3-text-red"></i>
                        </button>
                      </div>
                    </div>
                    
                    <div className="cart-preview-prices w3-row">
                      <div className="w3-col s6">
                        <span className="w3-medium w3-text-grey">
                          {parseFloat(item.product.cena).toFixed(2)} zł/szt
                        </span>
                      </div>
                      <div className="w3-col s6 w3-right-align">
                        <span className="w3-medium">
                          <b>{(parseFloat(item.product.cena) * item.quantity).toFixed(2)} zł</b>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {cart.length > 4 && (
              <div className="cart-preview-more w3-center w3-padding-small">
                <p className="w3-small w3-text-grey">
                  ... i {cart.length - 4} więcej produktów
                </p>
              </div>
            )}
          </div>
          
          <div className="cart-preview-footer">
            <div className="cart-preview-total w3-padding w3-light-grey">
              <div className="w3-row">
                <div className="w3-col s6">
                  <span><b>Razem:</b></span>
                </div>
                <div className="w3-col s6 w3-right-align">
                  <span className="w3-large"><b>{getCartTotal().toFixed(2)} zł</b></span>
                </div>
              </div>
            </div>
            
            <div className="cart-preview-actions w3-padding">
              <Link 
                to="/cart" 
                className="w3-button w3-black w3-block w3-margin-bottom"
              >
                <i className="fa fa-shopping-cart w3-margin-right"></i>
                Zobacz koszyk
              </Link>
              <Link 
                to="/checkout" 
                className="w3-button w3-green w3-block"
              >
                <i className="fa fa-credit-card w3-margin-right"></i>
                Zamów teraz
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

CartPreview.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onMouseEnter: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired
};