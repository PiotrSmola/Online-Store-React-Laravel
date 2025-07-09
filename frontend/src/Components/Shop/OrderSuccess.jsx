import { useLocation, Link } from "react-router-dom";

export default function OrderSuccess() {
  const location = useLocation();
  const { order, message } = location.state || {};

  if (!order) {
    return (
      <div className="w3-container w3-center w3-padding-64">
        <h2>Nie znaleziono informacji o zamówieniu</h2>
        <Link to="/" className="w3-button w3-black">
          Powrót do sklepu
        </Link>
      </div>
    );
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

  return (
    <div className="w3-container w3-padding-32">
      <div className="w3-center w3-margin-bottom">
        <i className="fa fa-check-circle w3-text-green" style={{ fontSize: "64px" }}></i>
        <h1 className="w3-text-green">Zamówienie zostało złożone!</h1>
        <p className="w3-large">{message}</p>
      </div>

      <div className="w3-card w3-padding">
        <h3>Szczegóły zamówienia</h3>
        <div className="w3-row">
          <div className="w3-col l8">
            <p><b>Numer zamówienia:</b> {order.order_number}</p>
            <p><b>Data zamówienia:</b> {new Date(order.order_date).toLocaleDateString('pl-PL')}</p>
            <p><b>Status:</b> {order.status === 'pending' ? 'Oczekuje na realizację' : order.status}</p>
          </div>
          <div className="w3-col l4">
            <div className="w3-right-align">
              <h2 className="w3-text-green">{order.total_amount} zł</h2>
            </div>
          </div>
        </div>

        <div className="w3-row w3-margin-top">
          <div className="w3-col s6">
            <div className="w3-card w3-light-grey w3-padding w3-margin-right">
              <h5>
                <i className={`fa ${getPaymentMethodIcon(order.payment_details?.method)} w3-margin-right`}></i>
                Płatność
              </h5>
              <p>{getPaymentMethodLabel(order.payment_details?.method)}</p>
              {order.payment_details?.method === 'card' && order.payment_details?.card_last_four && (
                <p className="w3-small w3-text-grey">
                  Karta kończąca się na ****{order.payment_details.card_last_four}
                </p>
              )}
            </div>
          </div>
          <div className="w3-col s6">
            <div className="w3-card w3-light-grey w3-padding w3-margin-left">
              <h5>
                <i className={`fa ${getDeliveryMethodIcon(order.delivery_method)} w3-margin-right`}></i>
                Dostawa
              </h5>
              <p>{getDeliveryMethodLabel(order.delivery_method)}</p>
              {order.delivery_price && order.delivery_price > 0 && (
                <p className="w3-small w3-text-grey">
                  Koszt: {parseFloat(order.delivery_price).toFixed(2)} zł
                </p>
              )}
              {order.delivery_price === 0 && (
                <p className="w3-small w3-text-green">Bezpłatna dostawa</p>
              )}
            </div>
          </div>
        </div>

        <h4 className="w3-margin-top">Zamówione produkty:</h4>

        <div className="w3-responsive w3-margin-top">
          <table className="w3-table w3-striped">
            <thead>
              <tr>
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
                      <div className="w3-col s4">
                        <img 
                          src={item.product.images?.[0] ? `http://localhost:8000/storage/products/${item.product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                          alt={item.product.nazwa}
                          style={{ 
                            width: '100%', 
                            height: '80px', 
                            objectFit: 'cover',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                      <div className="w3-col s8 w3-padding-small">
                        <span className="w3-medium">{item.product.nazwa}</span>
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

        <div className="w3-margin-top">
          <div className="w3-right-align w3-container" style={{ maxWidth: '350px', marginLeft: 'auto' }}>
            <div className="w3-card w3-light-grey w3-padding-large">
              <h5 style={{ marginTop: '0' }}>Podsumowanie kosztów</h5>
              <div className="w3-row w3-margin-bottom">
                <div className="w3-col s8">Wartość produktów:</div>
                <div className="w3-col s4 w3-right-align">
                  {(order.total_amount - (order.delivery_price || 0)).toFixed(2)} zł
                </div>
              </div>
              {order.delivery_price !== undefined && (
                <div className="w3-row w3-margin-bottom">
                  <div className="w3-col s8">Dostawa:</div>
                  <div className="w3-col s4 w3-right-align">
                    {order.delivery_price === 0 ? 'Bezpłatnie' : `${parseFloat(order.delivery_price).toFixed(2)} zł`}
                  </div>
                </div>
              )}
              <hr />
              <div className="w3-row">
                <div className="w3-col s8"><b>Razem:</b></div>
                <div className="w3-col s4 w3-right-align"><b>{order.total_amount} zł</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w3-center w3-margin-top">
        <Link to="/" className="w3-button w3-black w3-margin-right">
          Kontynuuj zakupy
        </Link>
        <Link to="/orders" className="w3-button w3-green">
          Moje zamówienia
        </Link>
      </div>
    </div>
  );
}