import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useShop();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  async function fetchProduct() {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
        if (data.rozmiar?.length > 0) {
          setSelectedSize(data.rozmiar[0]);
        }
        if (data.kolor?.length > 0) {
          setSelectedColor(data.kolor[0]);
        }
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  const handleAddToCart = () => {
    addToCart(product, selectedSize, selectedColor, quantity);
    alert('Produkt został dodany do koszyka!');
  };

  if (loading) {
    return <div className="w3-container w3-center w3-padding-64">Ładowanie...</div>;
  }

  if (!product) {
    return <div className="w3-container w3-center w3-padding-64">Produkt nie znaleziony</div>;
  }

  return (
    <div className="w3-container w3-padding-32">
      <div className="w3-row">
        <div className="w3-col l6">
          <img 
            src={product.images?.[0] ? `http://localhost:8000/storage/products/${product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
            alt={product.nazwa}
            className="product-detail-image"
          />
        </div>
        <div className="w3-col l6 w3-padding-large">
          <h1 className="w3-text-black">{product.nazwa}</h1>
          <p className="w3-text-grey">{product.kategoria}</p>
          
          <div className="w3-text-yellow w3-margin-bottom">
            {[...Array(5)].map((_, i) => (
              <i 
                key={i} 
                className={`fa fa-star${i < Math.floor(product.ocena) ? '' : '-o'}`}
              ></i>
            ))}
            <span className="w3-text-grey w3-small"> ({product.ocena})</span>
          </div>

          <h2 className="w3-text-red">{parseFloat(product.cena).toFixed(2)} zł</h2>

          <p className="w3-text-grey">{product.opis}</p>

          {product.rozmiar && product.rozmiar.length > 0 && (
            <div className="w3-margin-bottom">
              <label className="w3-text-black"><b>Rozmiar:</b></label>
              <select 
                className="w3-select w3-border w3-margin-top"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                {product.rozmiar.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          )}

          {product.kolor && product.kolor.length > 0 && (
            <div className="w3-margin-bottom">
              <label className="w3-text-black"><b>Kolor:</b></label>
              <select 
                className="w3-select w3-border w3-margin-top"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
              >
                {product.kolor.map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          )}

          <div className="w3-margin-bottom">
            <label className="w3-text-black"><b>Ilość:</b></label>
            <input 
              type="number" 
              className="w3-input w3-border w3-margin-top"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={{ width: "100px" }}
            />
          </div>

          <button 
            className="w3-button w3-black w3-padding-large w3-large w3-margin-top"
            onClick={handleAddToCart}
          >
            Dodaj do koszyka <i className="fa fa-shopping-cart"></i>
          </button>
        </div>
      </div>
    </div>
  );
}