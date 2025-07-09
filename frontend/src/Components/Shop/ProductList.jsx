import { Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function ProductList() {
  const { products, loading, addToCart } = useShop();

  if (loading) {
    return <div className="w3-container w3-center w3-padding-64">Ładowanie...</div>;
  }

  return (
    <>
      <div className="w3-display-container w3-container">
        <img 
          src={'http://localhost:8000/storage/header-banner.jpg'} 
          alt="Sklep" 
          className="header-banner"
          style={{ width: "100%", height: "auto" }}
        />
        <div className="w3-display-topleft w3-text-white" style={{ padding: "24px 48px" }}>
          <h1 className="w3-jumbo w3-hide-small">Nowe produkty</h1>
          <h1 className="w3-hide-large w3-hide-medium">Nowe produkty</h1>
          <h1 className="w3-hide-small">KOLEKCJA 2024</h1>
          <p>
            <a href="#products" className="w3-button w3-black w3-padding-large w3-large">
              ZOBACZ PRODUKTY
            </a>
          </p>
        </div>
      </div>

      <div className="w3-container w3-text-grey" id="products">
        <p>{products.length} produktów</p>
      </div>

      {/* Product grid */}
      <div className="w3-row w3-grayscale">
        {products.map((product, index) => (
          <div key={product.id} className="w3-col l3 s6">
            <div className="w3-container">
              <div className="w3-display-container">
                <img 
                  src={product.images?.[0] ? `http://localhost:8000/storage/products/${product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                  alt={product.nazwa}
                  className="product-image"
                />
                {index === 1 && <span className="w3-tag w3-display-topleft">Nowość</span>}
                {index === 5 && <span className="w3-tag w3-display-topleft">Wyprzedaż</span>}
                
                <div className="w3-display-middle w3-display-hover">
                  <button 
                    className="w3-button w3-black"
                    onClick={() => addToCart(product)}
                  >
                    Kup teraz <i className="fa fa-shopping-cart"></i>
                  </button>
                </div>
              </div>
              <Link to={`/product/${product.id}`} className="product-link">
                <p>
                  {product.nazwa}<br />
                  <b className={index === 5 ? "w3-text-red" : ""}>
                    {parseFloat(product.cena).toFixed(2)} zł
                  </b>
                </p>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="w3-container w3-center w3-padding-64">
          <p>Brak produktów do wyświetlenia.</p>
        </div>
      )}

      <div className="w3-container w3-black w3-padding-32">
        <h1>Newsletter</h1>
        <p>Aby otrzymywać oferty specjalne i być traktowanym jak VIP:</p>
        <p>
          <input 
            className="w3-input w3-border" 
            type="text" 
            placeholder="Wprowadź e-mail" 
            style={{ width: "100%" }}
          />
        </p>
        <button type="button" className="w3-button w3-red w3-margin-bottom">
          Zapisz się
        </button>
      </div>
    </>
  );
}