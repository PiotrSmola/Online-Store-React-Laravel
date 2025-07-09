import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function CategoryProducts() {
  const { category } = useParams();
  const { addToCart } = useShop();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoryProducts();
  }, [category]);

  async function fetchCategoryProducts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/category/${encodeURIComponent(category)}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching category products:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="w3-container w3-center w3-padding-64">Ładowanie...</div>;
  }

  return (
    <>
      <div className="w3-display-container w3-container">
        <img 
          src={'http://localhost:8000/storage/header-banner.jpg'} 
          alt={decodeURIComponent(category)} 
          className="category-banner"
          style={{ width: "100%", height: "auto" }}
        />
        <div className="w3-display-topleft w3-text-white" style={{ padding: "24px 48px" }}>
          <h1 className="w3-jumbo w3-hide-small">{decodeURIComponent(category)}</h1>
          <h1 className="w3-hide-large w3-hide-medium">{decodeURIComponent(category)}</h1>
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
                {index === 3 && <span className="w3-tag w3-display-topleft">Wyprzedaż</span>}
                
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
                  <b className={index === 3 ? "w3-text-red" : ""}>
                    {parseFloat(product.cena).toFixed(2)} zł
                  </b>
                </p>
              </Link>
              <div className="w3-text-yellow">
                {[...Array(5)].map((_, i) => (
                  <i 
                    key={i} 
                    className={`fa fa-star${i < Math.floor(product.ocena) ? '' : '-o'}`}
                  ></i>
                ))}
                <span className="w3-text-grey w3-small"> ({product.ocena})</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="w3-container w3-center w3-padding-64">
          <p>Brak produktów w tej kategorii.</p>
        </div>
      )}
    </>
  );
}