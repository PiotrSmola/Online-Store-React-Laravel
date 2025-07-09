import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customer, customerToken } = useShop();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer && customerToken) {
      fetchOrderDetail();
    } else {
      navigate('/login');
    }
  }, [id, customer, customerToken]);

  async function fetchOrderDetail() {
    try {
      const res = await fetch(`http://localhost:8000/api/orders/${id}`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      } else if (res.status === 404) {
        navigate('/orders');
      } else {
        console.error('Order fetch failed:', res.status, res.statusText);
      }
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  }

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'card': 'Płatność kartą',
      'transfer': 'Przelew bankowy',
      'cash': 'Płatność w sklepie'
    };
    return methods[method] || method;
  };

  const getDeliveryMethodLabel = (method) => {
    const methods = {
      'courier': 'Kurier',
      'pickup_point': 'Paczkomat',
      'store_pickup': 'Odbiór w sklepie'
    };
    return methods[method] || method;
  };

  const getPaymentMethodIcon = (method) => {
    const icons = {
      'card': 'fa-credit-card',
      'transfer': 'fa-bank',
      'cash': 'fa-money'
    };
    return icons[method] || 'fa-credit-card';
  };

  const getDeliveryMethodIcon = (method) => {
    const icons = {
      'courier': 'fa-truck',
      'pickup_point': 'fa-archive',
      'store_pickup': 'fa-store'
    };
    return icons[method] || 'fa-truck';
  };

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

  if (loading) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <div className="loading-spinner"></div>
        <p>Ładowanie szczegółów zamówienia...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <h2>Zamówienie nie zostało znalezione</h2>
        <Link to="/orders" className="w3-button w3-black">
          Powrót do zamówień
        </Link>
      </div>
    );
  }

  return (
    <div className="w3-container w3-padding-32">
      <div className="w3-margin-bottom">
        <Link to="/orders" className="w3-text-blue">
          <i className="fa fa-arrow-left w3-margin-right"></i>
          Powrót do zamówień
        </Link>
      </div>

      {/* Nagłówek zamówienia */}
      <div className="w3-card w3-padding w3-margin-bottom">
        <div className="w3-row">
          <div className="w3-col l8 m8 s12">
            <h2 className="w3-margin-bottom">
              <i className="fa fa-file-text-o w3-margin-right w3-text-grey"></i>
              Zamówienie #{order.order_number}
            </h2>
            <p className="w3-large w3-text-grey w3-margin-bottom">
              <i className="fa fa-calendar w3-margin-right"></i>
              Data zamówienia: {new Date(order.order_date).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <div className="w3-margin-bottom">
              <span className={`w3-tag w3-large ${getStatusColor(order.status)} w3-round`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>
          <div className="w3-col l4 m4 s12 w3-right-align">
            <h2 className="w3-text-green w3-margin-bottom">{order.total_amount} zł</h2>
            <p className="w3-text-grey">Wartość zamówienia</p>
          </div>
        </div>
      </div>

      {/* Metody płatności i dostawy */}
      <div className="w3-row w3-margin-bottom">
        <div className="w3-col l6 m6 s12">
          <div className="w3-card w3-padding w3-margin-right payment-delivery-card">
            <h4 className="w3-margin-bottom">
              <i className={`fa ${getPaymentMethodIcon(order.payment_method)} w3-margin-right`}></i>
              Płatność
            </h4>
            <p className="w3-large w3-margin-bottom">{getPaymentMethodLabel(order.payment_method)}</p>
            {order.payment_details?.card_last_four && (
              <p className="w3-text-grey">
                <i className="fa fa-credit-card w3-margin-right"></i>
                Karta kończąca się na ****{order.payment_details.card_last_four}
              </p>
            )}
            {order.payment_details?.instructions && (
              <p className="w3-text-grey w3-small">
                <i className="fa fa-info-circle w3-margin-right"></i>
                {order.payment_details.instructions}
              </p>
            )}
          </div>
        </div>
        <div className="w3-col l6 m6 s12">
          <div className="w3-card w3-padding w3-margin-left payment-delivery-card">
            <h4 className="w3-margin-bottom">
              <i className={`fa ${getDeliveryMethodIcon(order.delivery_method)} w3-margin-right`}></i>
              Dostawa
            </h4>
            <p className="w3-large w3-margin-bottom">{getDeliveryMethodLabel(order.delivery_method)}</p>
            <p className="w3-text-grey">
              <i className="fa fa-money w3-margin-right"></i>
              Koszt: {order.delivery_price === 0 ? 'Bezpłatna dostawa' : `${parseFloat(order.delivery_price).toFixed(2)} zł`}
            </p>
          </div>
        </div>
      </div>

      {/* Adres dostawy */}
      <div className="w3-card w3-padding w3-margin-bottom">
        <h4 className="w3-margin-bottom">
          <i className="fa fa-map-marker w3-margin-right"></i>
          Adres dostawy
        </h4>
        <div className="w3-row">
          <div className="w3-col l6 m6 s12">
            <p className="w3-margin-bottom">
              <b>{order.shipping_address.first_name} {order.shipping_address.last_name}</b>
            </p>
            {order.shipping_address.company_name && (
              <p className="w3-margin-bottom w3-text-grey">
                {order.shipping_address.company_name}
              </p>
            )}
            <p className="w3-margin-bottom">{order.shipping_address.address}</p>
            <p className="w3-margin-bottom">
              {order.shipping_address.postal_code} {order.shipping_address.city}
            </p>
            <p className="w3-text-grey">{order.shipping_address.country}</p>
          </div>
        </div>
      </div>

      {/* Produkty */}
      <div className="w3-card w3-padding w3-margin-bottom">
        <h4 className="w3-margin-bottom">
          <i className="fa fa-shopping-cart w3-margin-right"></i>
          Zamówione produkty ({order.items.length})
        </h4>

        <div className="w3-responsive">
          <table className="w3-table w3-striped w3-bordered">
            <thead>
              <tr className="w3-light-grey">
                <th>Produkt</th>
                <th>Rozmiar</th>
                <th>Kolor</th>
                <th>Ilość</th>
                <th>Cena jednostkowa</th>
                <th>Suma</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="w3-row">
                      <div className="w3-col s3">
                        <img 
                          src={item.product.images?.[0] ? `http://localhost:8000/storage/products/${item.product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                          alt={item.product.nazwa}
                          className="product-thumbnail-medium"
                        />
                      </div>
                      <div className="w3-col s9 w3-padding-small">
                        <span>{item.product.nazwa}</span>
                      </div>
                    </div>
                  </td>
                  <td>{item.selected_size || '-'}</td>
                  <td>{item.selected_color || '-'}</td>
                  <td>{item.quantity}</td>
                  <td>{parseFloat(item.price).toFixed(2)} zł</td>
                  <td><b>{(parseFloat(item.price) * item.quantity).toFixed(2)} zł</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w3-row">
        <div className="w3-col l6 w3-margin-auto">
          <div className="w3-card cost-summary w3-padding">
            <h4 className="w3-margin-bottom w3-center">Podsumowanie kosztów</h4>
            
            <div className="cost-row w3-row">
              <div className="w3-col s8">Wartość produktów:</div>
              <div className="w3-col s4 w3-right-align">
                {(order.total_amount - (order.delivery_price || 0)).toFixed(2)} zł
              </div>
            </div>
            
            {order.delivery_price !== undefined && (
              <div className="cost-row w3-row">
                <div className="w3-col s8">Dostawa:</div>
                <div className="w3-col s4 w3-right-align">
                  {order.delivery_price === 0 ? 'Bezpłatnie' : `${parseFloat(order.delivery_price).toFixed(2)} zł`}
                </div>
              </div>
            )}
            
            <div className="cost-row w3-row">
              <div className="w3-col s8"><b>Razem do zapłaty:</b></div>
              <div className="w3-col s4 w3-right-align"><b>{order.total_amount} zł</b></div>
            </div>
          </div>
        </div>
      </div>

      <div className="w3-center w3-margin-top w3-padding">
        <Link to="/orders" className="w3-button w3-black w3-margin-right">
          <i className="fa fa-list w3-margin-right"></i>
          Wszystkie zamówienia
        </Link>
        <Link to="/" className="w3-button w3-green">
          <i className="fa fa-shopping-cart w3-margin-right"></i>
          Kontynuuj zakupy
        </Link>
      </div>
    </div>
  );
}