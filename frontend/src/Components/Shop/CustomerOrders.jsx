import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function CustomerOrders() {
  const { customer, customerToken } = useShop();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer && customerToken) {
      fetchOrders();
    }
  }, [customer, customerToken]);

  async function fetchOrders() {
    try {
      const res = await fetch('http://localhost:8000/api/orders', {
        headers: {
          Authorization: `Bearer ${customerToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else {
        console.error('Orders fetch failed:', res.status, res.statusText);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusLabel = (status) => {
    const statuses = {
      'pending': 'Oczekuje na realizację',
      'processing': 'W realizacji',
      'shipped': 'Wysłane',
      'delivered': 'Dostarczone',
      'cancelled': 'Anulowane'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'w3-orange',
      'processing': 'w3-blue',
      'shipped': 'w3-purple',
      'delivered': 'w3-green',
      'cancelled': 'w3-red'
    };
    return colors[status] || 'w3-grey';
  };

  if (!customer) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <h2>Musisz być zalogowany, aby zobaczyć swoje zamówienia</h2>
        <Link to="/login" className="w3-button w3-black">
          Zaloguj się
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <div className="loading-spinner"></div>
        <p>Ładowanie zamówień...</p>
      </div>
    );
  }

  return (
    <div className="w3-container w3-padding-32">
      <h1>Moje zamówienia</h1>
      
      {orders.length === 0 ? (
        <div className="w3-center w3-padding-64">
          <i className="fa fa-shopping-bag w3-text-grey" style={{ fontSize: '64px' }}></i>
          <h3 className="w3-text-grey">Nie masz jeszcze żadnych zamówień</h3>
          <p className="w3-text-grey">Gdy złożysz pierwsze zamówienie, pojawi się ono tutaj.</p>
          <Link to="/" className="w3-button w3-black w3-margin-top">
            <i className="fa fa-shopping-cart w3-margin-right"></i>
            Rozpocznij zakupy
          </Link>
        </div>
      ) : (
        <>
          <div className="w3-margin-bottom">
            <p className="w3-text-grey">
              <i className="fa fa-info-circle w3-margin-right"></i>
              Kliknij na zamówienie, aby zobaczyć szczegóły
            </p>
          </div>

          <div className="orders-list">
            {orders.map((order) => (
              <Link 
                key={order.id} 
                to={`/orders/${order.id}`}
                className="order-item-link"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="w3-card w3-margin-bottom order-item w3-hover-shadow">
                  <div className="w3-container w3-padding">
                    <div className="w3-row w3-margin-bottom">
                      <div className="w3-col l3 m6 s12">
                        <h5 className="w3-margin-bottom">
                          <i className="fa fa-file-text-o w3-margin-right w3-text-grey"></i>
                          #{order.order_number}
                        </h5>
                        <p className="w3-small w3-text-grey w3-margin-bottom">
                          <i className="fa fa-calendar w3-margin-right"></i>
                          {new Date(order.order_date).toLocaleDateString('pl-PL', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      
                      <div className="w3-col w3-hide-small l2 m6 s12 w3-center" style={{ marginTop: '16px', marginRight: '16px' }}>
                        <div className="order-status">
                          <span className={`w3-tag w3-round ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="w3-col l3 m6 s12">
                        <div className="order-preview">
                          <p className="w3-medium w3-text-grey w3-margin-bottom">
                            <i className="fa fa-shopping-cart w3-margin-right"></i>
                            {order.items.length} {order.items.length === 1 ? 'produkt' : 'produktów'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="w3-col l3 m6 s12 w3-right-align">
                        <div className="order-total">
                          <h4 className="w3-text-green w3-margin-bottom">
                            {order.total_amount} zł
                          </h4>
                          <p className="w3-small w3-text-grey">
                            <i className="fa fa-eye w3-margin-right"></i>
                            Zobacz szczegóły
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* na urządzeniach mobilnych */}
                    <div className="w3-hide-large w3-hide-medium w3-border-top w3-padding-top">
                      <div className="w3-row">
                        <div className="w3-col s6">
                          <span className={`w3-tag w3-round ${getStatusColor(order.status)} w3-small`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <div className="w3-col s6 w3-right-align">
                          <span className="w3-large w3-text-green">
                            <b>{order.total_amount} zł</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="w3-center w3-margin-top">
            <Link to="/" className="w3-button w3-black">
              <i className="fa fa-shopping-cart w3-margin-right"></i>
              Kontynuuj zakupy
            </Link>
          </div>
        </>
      )}
    </div>
  );
}