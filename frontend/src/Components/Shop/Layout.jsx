import { Link, Outlet, useLocation } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";
import { useState, useEffect } from "react";
import CartPreview from "./CartPreview";

export default function ShopLayout() {
  const { categories, getCartItemsCount, customer, logoutCustomer } = useShop();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [cartPreviewVisible, setCartPreviewVisible] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = async () => {
    await logoutCustomer();
  };

  const handleCartMouseEnter = () => {
    setCartPreviewVisible(true);
  };

  const handleCartMouseLeave = () => {
    setCartPreviewVisible(false);
  };

  useEffect(() => {
    window.w3_open = () => {
      setSidebarOpen(true);
    };
    
    window.w3_close = () => {
      setSidebarOpen(false);
    };

    window.myAccFunc = () => {
      setCategoriesOpen(!categoriesOpen);
    };
  }, [categoriesOpen]);

  return (
    <div className="w3-content" style={{ maxWidth: "1200px" }}>
      <nav 
        className={`w3-sidebar w3-bar-block w3-white w3-collapse w3-top ${sidebarOpen ? 'w3-show' : ''}`}
        style={{ zIndex: 3, width: "250px" }}
        id="mySidebar"
      >
        <div className="w3-container w3-display-container w3-padding-16">
          <i 
            onClick={closeSidebar} 
            className="fa fa-remove w3-hide-large w3-button w3-display-topright"
          ></i>
          <h3 className="w3-wide"><b>SKLEP</b></h3>
        </div>
        <div className="w3-padding-48 w3-large w3-text-grey" style={{ fontWeight: "bold" }}>
          <Link to="/" className="w3-bar-item w3-button" onClick={closeSidebar}>
            Wszystkie produkty
          </Link>
          
          <a 
            onClick={() => setCategoriesOpen(!categoriesOpen)} 
            href="javascript:void(0)" 
            className="w3-button w3-block w3-white w3-left-align"
            id="myBtn"
          >
            Kategorie <i className="fa fa-caret-down"></i>
          </a>
          <div 
            id="demoAcc" 
            className={`w3-bar-block w3-padding-large w3-medium ${categoriesOpen ? 'w3-show' : 'w3-hide'}`}
          >
            {categories.map((category) => (
              <Link
                key={category}
                to={`/category/${encodeURIComponent(category)}`}
                className="w3-bar-item w3-button w3-text-gray"
                onClick={closeSidebar}
              >
                <i className="fa fa-caret-right w3-margin-right"></i>
                {category}
              </Link>
            ))}
          </div>
          
          {customer && (
            <>
              <Link to="/orders" className="w3-bar-item w3-button" onClick={closeSidebar}>
                Moje zamówienia
              </Link>
            </>
          )}
        </div>
        
        <a href="#footer" className="w3-bar-item w3-button w3-padding">Kontakt</a>
        <a 
          href="javascript:void(0)" 
          className="w3-bar-item w3-button w3-padding" 
          onClick={() => setNewsletterOpen(true)}
        >
          Newsletter
        </a>
        
        {customer ? (
          <div className="w3-padding">
            <p className="w3-text-grey w3-medium">Witaj, {customer.first_name}!</p>
            <button onClick={handleLogout} className="w3-bar-item w3-button w3-padding">
              Wyloguj
            </button>
          </div>
        ) : (
          <Link to="/login" className="w3-bar-item w3-button w3-padding" onClick={closeSidebar}>
            Logowanie
          </Link>
        )}
      </nav>

      <header className="w3-bar w3-top w3-hide-large w3-black w3-xlarge">
        <div className="w3-bar-item w3-padding-24 w3-wide">SKLEP</div>
        <a 
          href="javascript:void(0)" 
          className="w3-bar-item w3-button w3-padding-24 w3-right" 
          onClick={toggleSidebar}
        >
          <i className="fa fa-bars"></i>
        </a>
      </header>

      {sidebarOpen && (
        <div 
          className="w3-overlay w3-hide-large" 
          onClick={closeSidebar} 
          style={{ cursor: "pointer" }} 
          title="close side menu"
          id="myOverlay"
        ></div>
      )}

      <div className="w3-main" style={{ marginLeft: "250px" }}>
        <div className="w3-hide-large" style={{ marginTop: "83px" }}></div>
        
        <header className="w3-container w3-xlarge">
          <p className="w3-left">
            {location.pathname === '/' ? 'Sklep' : 
             location.pathname.includes('/category/') ? decodeURIComponent(location.pathname.split('/')[2]) :
             location.pathname.includes('/product/') ? 'Produkt' :
             location.pathname.includes('/cart') ? 'Koszyk' :
             location.pathname.includes('/checkout') ? 'Zamówienie' : 
             location.pathname.includes('/orders') ? 'Zamówienia' : 'Sklep'}
          </p>
          <p className="w3-right">
            <div 
              className="cart-icon-container"
              onMouseEnter={handleCartMouseEnter}
              onMouseLeave={handleCartMouseLeave}
              style={{ position: 'relative', display: 'inline-block' }}
            >
              <Link 
                to="/cart" 
                className="w3-margin-right cart-icon-link" 
                style={{ position: 'relative', color: 'inherit', textDecoration: 'none' }}
              >
                <i className="fa fa-shopping-cart"></i>
                {getCartItemsCount() > 0 && (
                  <span 
                    className="w3-badge w3-red w3-small cart-badge" 
                    style={{ 
                      position: 'absolute', 
                      top: '-8px', 
                      right: '-8px',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px'
                    }}
                  >
                    {getCartItemsCount()}
                  </span>
                )}
              </Link>
              
              <CartPreview 
                isVisible={cartPreviewVisible}
                onMouseEnter={handleCartMouseEnter}
                onMouseLeave={handleCartMouseLeave}
              />
            </div>
            <i className="fa fa-search"></i>
          </p>
        </header>

        <main>
          <Outlet />
        </main>

        <footer className="w3-padding-64 w3-light-grey w3-small w3-center" id="footer">
          <div className="w3-row-padding">
            <div className="w3-col s4">
              <h4>Kontakt</h4>
              <p>Masz pytania? Napisz do nas.</p>
              <form>
                <p><input className="w3-input w3-border" type="text" placeholder="Imię" name="Name" required /></p>
                <p><input className="w3-input w3-border" type="text" placeholder="Email" name="Email" required /></p>
                <p><input className="w3-input w3-border" type="text" placeholder="Temat" name="Subject" required /></p>
                <p><input className="w3-input w3-border" type="text" placeholder="Wiadomość" name="Message" required /></p>
                <button type="submit" className="w3-button w3-block w3-black">Wyślij</button>
              </form>
            </div>

            <div className="w3-col s4">
              <h4>O nas</h4>
              <p><a href="#">O firmie</a></p>
              <p><a href="#">Rekrutacja</a></p>
              <p><a href="#">Wsparcie</a></p>
              <p><a href="#">Znajdź sklep</a></p>
              <p><a href="#">Dostawa</a></p>
              <p><a href="#">Płatności</a></p>
              <p><a href="#">Karta podarunkowa</a></p>
              <p><a href="#">Zwroty</a></p>
              <p><a href="#">Pomoc</a></p>
            </div>

            <div className="w3-col s4 w3-justify">
              <h4>Sklep</h4>
              <p><i className="fa fa-fw fa-map-marker"></i> Nazwa firmy</p>
              <p><i className="fa fa-fw fa-phone"></i> 0044123123</p>
              <p><i className="fa fa-fw fa-envelope"></i> sklep@example.com</p>
              <h4>Akceptujemy</h4>
              <p><i className="fa fa-fw fa-cc-amex"></i> Amex</p>
              <p><i className="fa fa-fw fa-credit-card"></i> Karta kredytowa</p>
              <br />
              <i className="fa fa-facebook-official w3-hover-opacity w3-large"></i>
              <i className="fa fa-instagram w3-hover-opacity w3-large"></i>
              <i className="fa fa-snapchat w3-hover-opacity w3-large"></i>
              <i className="fa fa-pinterest-p w3-hover-opacity w3-large"></i>
              <i className="fa fa-twitter w3-hover-opacity w3-large"></i>
              <i className="fa fa-linkedin w3-hover-opacity w3-large"></i>
            </div>
          </div>
        </footer>

        <div className="w3-black w3-center w3-padding-24">
          Powered by <a href="https://www.w3schools.com/w3css/default.asp" title="W3.CSS" target="_blank" className="w3-hover-opacity">w3.css</a>
        </div>

        {newsletterOpen && (
          <div id="newsletter" className="w3-modal" style={{ display: 'block' }}>
            <div className="w3-modal-content w3-animate-zoom" style={{ padding: "32px" }}>
              <div className="w3-container w3-white w3-center">
                <i 
                  onClick={() => setNewsletterOpen(false)} 
                  className="fa fa-remove w3-right w3-button w3-transparent w3-xxlarge"
                ></i>
                <h2 className="w3-wide">NEWSLETTER</h2>
                <p>Dołącz do naszej listy mailingowej, aby otrzymywać informacje o nowościach i ofertach specjalnych.</p>
                <p>
                  <input 
                    className="w3-input w3-border" 
                    type="text" 
                    placeholder="Wprowadź e-mail"
                  />
                </p>
                <button 
                  type="button" 
                  className="w3-button w3-padding-large w3-red w3-margin-bottom" 
                  onClick={() => setNewsletterOpen(false)}
                >
                  Zapisz się
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}