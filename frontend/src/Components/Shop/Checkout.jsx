import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function Checkout() {
  const { cart, getCartTotal, clearCart, loginCustomer, customer } = useShop();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_type: 'individual',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    nip: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Polska',
    payment_method: 'card',
    delivery_method: 'courier',
    payment: {
      card_number: '',
      card_name: '',
      expiry_date: '',
      cvv: ''
    }
  });

  const [errors, setErrors] = useState({});

  // autouzupełnienie danymi zalogowanego klienta
  useEffect(() => {
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customer_type: customer.customer_type || 'individual',
        email: customer.email || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone: customer.phone || '',
        company_name: customer.company_name || '',
        nip: customer.nip || '',
        address: customer.address || '',
        city: customer.city || '',
        postal_code: customer.postal_code || '',
        country: customer.country || 'Polska'
      }));
    }
  }, [customer]);

  if (cart.length === 0) {
    navigate('/cart');
    return null;
  }

  const paymentMethods = [
    { value: 'card', label: 'Płatność kartą', icon: 'fa-credit-card' },
    { value: 'transfer', label: 'Przelew bankowy', icon: 'fa-bank' },
    { value: 'cash', label: 'Płatność w sklepie', icon: 'fa-money' }
  ];

  const deliveryMethods = [
    { value: 'courier', label: 'Kurier', price: 15.99, icon: 'fa-truck' },
    { value: 'pickup_point', label: 'Paczkomat', price: 12.99, icon: 'fa-archive' },
    { value: 'store_pickup', label: 'Odbiór w sklepie', price: 0, icon: 'fa-store' }
  ];

  const getDeliveryPrice = () => {
    const method = deliveryMethods.find(m => m.value === formData.delivery_method);
    return method ? method.price : 0;
  };

  const getTotalWithDelivery = () => {
    return getCartTotal() + getDeliveryPrice();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('payment.')) {
      const paymentField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        payment: {
          ...prev.payment,
          [paymentField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    setFormData(prev => ({
      ...prev,
      payment: {
        ...prev.payment,
        card_number: formatted
      }
    }));
  };

  const handleExpiryChange = (e) => {
    const formatted = formatExpiryDate(e.target.value);
    setFormData(prev => ({
      ...prev,
      payment: {
        ...prev.payment,
        expiry_date: formatted
      }
    }));
  };

  // Walidacja algorytmem Luhn dla numeru karty
  const validateCardNumber = (cardNumber) => {
    const digits = cardNumber.replace(/\s/g, '').split('').map(Number);
    let sum = 0;
    let alternate = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = digits[i];
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      sum += n;
      alternate = !alternate;
    }
    
    return sum % 10 === 0;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) newErrors.email = 'Email jest wymagany';
    if (!customer && (!formData.password || formData.password.length < 6)) {
      newErrors.password = 'Hasło musi mieć minimum 6 znaków';
    }
    if (!formData.first_name) newErrors.first_name = 'Imię jest wymagane';
    if (!formData.last_name) newErrors.last_name = 'Nazwisko jest wymagane';
    if (!formData.phone) newErrors.phone = 'Telefon jest wymagany';
    if (!formData.address) newErrors.address = 'Adres jest wymagany';
    if (!formData.city) newErrors.city = 'Miasto jest wymagane';
    if (!formData.postal_code) newErrors.postal_code = 'Kod pocztowy jest wymagany';

    if (formData.customer_type === 'company') {
      if (!formData.company_name) newErrors.company_name = 'Nazwa firmy jest wymagana';
      if (!formData.nip) newErrors.nip = 'NIP jest wymagany';
    }

    // Walidacja płatności kartą
    if (formData.payment_method === 'card') {
      const cardNumber = formData.payment.card_number.replace(/\s/g, '');
      
      if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
        newErrors['payment.card_number'] = 'Numer karty musi mieć od 13 do 19 cyfr';
      } else if (!validateCardNumber(cardNumber)) {
        newErrors['payment.card_number'] = 'Nieprawidłowy numer karty';
      }
      
      if (!formData.payment.card_name) {
        newErrors['payment.card_name'] = 'Imię i nazwisko posiadacza karty jest wymagane';
      }
      
      if (!formData.payment.expiry_date || formData.payment.expiry_date.length !== 5) {
        newErrors['payment.expiry_date'] = 'Data ważności musi być w formacie MM/RR';
      }
      
      if (!formData.payment.cvv || formData.payment.cvv.length < 3 || formData.payment.cvv.length > 4) {
        newErrors['payment.cvv'] = 'CVV musi mieć 3-4 cyfry';
      }

      if (formData.payment.expiry_date.length === 5) {
        const [month, year] = formData.payment.expiry_date.split('/');
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        
        if (parseInt(month) < 1 || parseInt(month) > 12) {
          newErrors['payment.expiry_date'] = 'Nieprawidłowy miesiąc';
        } else if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
          newErrors['payment.expiry_date'] = 'Karta jest przeterminowana';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        ...formData,
        company_name: formData.customer_type === 'company' ? formData.company_name : null,
        nip: formData.customer_type === 'company' ? formData.nip : null,
        cart_items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          selected_size: item.selectedSize,
          selected_color: item.selectedColor
        })),
        delivery_price: getDeliveryPrice(),
        total_with_delivery: getTotalWithDelivery()
      };

      const res = await fetch('http://localhost:8000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(orderData)
      });

      const data = await res.json();

      if (res.ok) {
        if (!customer) {
          loginCustomer(data.customer, data.token);
        }
        clearCart();
        
        navigate('/order-success', { 
          state: { 
            order: data.order,
            message: data.message 
          } 
        });
      } else {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          alert('Wystąpił błąd podczas składania zamówienia: ' + (data.message || 'Nieznany błąd'));
        }
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Wystąpił błąd podczas składania zamówienia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w3-container w3-padding-32">
      <h1>Zamówienie</h1>
      
      <div className="w3-row">
        <div className="w3-col l8 w3-margin-right">
          <form onSubmit={handleSubmit}>
            <div className="w3-margin-bottom">
              <label className="w3-text-black"><b>Typ klienta:</b></label>
              <div className="w3-margin-top">
                <input 
                  type="radio" 
                  id="individual" 
                  name="customer_type" 
                  value="individual"
                  checked={formData.customer_type === 'individual'}
                  onChange={handleInputChange}
                />
                <label htmlFor="individual" className="w3-margin-left">Klient indywidualny</label>
                
                <input 
                  type="radio" 
                  id="company" 
                  name="customer_type" 
                  value="company"
                  checked={formData.customer_type === 'company'}
                  onChange={handleInputChange}
                  className="w3-margin-left"
                />
                <label htmlFor="company" className="w3-margin-left">Firma</label>
              </div>
            </div>

            <div className="w3-row">
              <div className="w3-col s6 w3-padding-small">
                <label className="w3-text-black"><b>Email:</b></label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  disabled={!!customer}
                  required
                />
                {errors.email && <p className="w3-text-red w3-small">{errors.email}</p>}
              </div>
              {!customer && (
                <div className="w3-col s6 w3-padding-small">
                  <label className="w3-text-black"><b>Hasło:</b></label>
                  <input 
                    type="password" 
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w3-input w3-border w3-margin-top"
                    required
                  />
                  {errors.password && <p className="w3-text-red w3-small">{errors.password}</p>}
                </div>
              )}
            </div>

            <div className="w3-row">
              <div className="w3-col s6 w3-padding-small">
                <label className="w3-text-black"><b>Imię:</b></label>
                <input 
                  type="text" 
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  required
                />
                {errors.first_name && <p className="w3-text-red w3-small">{errors.first_name}</p>}
              </div>
              <div className="w3-col s6 w3-padding-small">
                <label className="w3-text-black"><b>Nazwisko:</b></label>
                <input 
                  type="text" 
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  required
                />
                {errors.last_name && <p className="w3-text-red w3-small">{errors.last_name}</p>}
              </div>
            </div>

            <div className="w3-margin-bottom w3-padding-small">
              <label className="w3-text-black"><b>Telefon:</b></label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w3-input w3-border w3-margin-top"
                required
              />
              {errors.phone && <p className="w3-text-red w3-small">{errors.phone}</p>}
            </div>

            {formData.customer_type === 'company' && (
              <>
                <div className="w3-margin-bottom w3-padding-small">
                  <label className="w3-text-black"><b>Nazwa firmy:</b></label>
                  <input 
                    type="text" 
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className="w3-input w3-border w3-margin-top"
                    required
                  />
                  {errors.company_name && <p className="w3-text-red w3-small">{errors.company_name}</p>}
                </div>
                <div className="w3-margin-bottom w3-padding-small">
                  <label className="w3-text-black"><b>NIP:</b></label>
                  <input 
                    type="text" 
                    name="nip"
                    value={formData.nip}
                    onChange={handleInputChange}
                    className="w3-input w3-border w3-margin-top"
                    required
                  />
                  {errors.nip && <p className="w3-text-red w3-small">{errors.nip}</p>}
                </div>
              </>
            )}

            <h3>Adres</h3>
            <div className="w3-margin-bottom w3-padding-small">
              <label className="w3-text-black"><b>Ulica i numer:</b></label>
              <input 
                type="text" 
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w3-input w3-border w3-margin-top"
                required
              />
              {errors.address && <p className="w3-text-red w3-small">{errors.address}</p>}
            </div>

            <div className="w3-row">
              <div className="w3-col s6 w3-padding-small">
                <label className="w3-text-black"><b>Miasto:</b></label>
                <input 
                  type="text" 
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  required
                />
                {errors.city && <p className="w3-text-red w3-small">{errors.city}</p>}
              </div>
              <div className="w3-col s6 w3-padding-small">
                <label className="w3-text-black"><b>Kod pocztowy:</b></label>
                <input 
                  type="text" 
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  placeholder="00-000"
                  required
                />
                {errors.postal_code && <p className="w3-text-red w3-small">{errors.postal_code}</p>}
              </div>
            </div>

            <div className="w3-margin-bottom w3-padding-small">
              <label className="w3-text-black"><b>Kraj:</b></label>
              <input 
                type="text" 
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w3-input w3-border w3-margin-top"
                required
              />
            </div>

            <h3>Metoda dostawy</h3>
            <div className="w3-margin-bottom w3-padding-small">
              {deliveryMethods.map(method => (
                <div key={method.value} className="w3-margin-bottom">
                  <input 
                    type="radio" 
                    id={`delivery_${method.value}`}
                    name="delivery_method" 
                    value={method.value}
                    checked={formData.delivery_method === method.value}
                    onChange={handleInputChange}
                  />
                  <label htmlFor={`delivery_${method.value}`} className="w3-margin-left">
                    <i className={`fa ${method.icon} w3-margin-right`}></i>
                    {method.label} 
                    <span className="w3-text-green w3-margin-left">
                      {method.price === 0 ? 'Bezpłatnie' : `${method.price.toFixed(2)} zł`}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <h3>Metoda płatności</h3>
            <div className="w3-margin-bottom w3-padding-small">
              {paymentMethods.map(method => (
                <div key={method.value} className="w3-margin-bottom">
                  <input 
                    type="radio" 
                    id={`payment_${method.value}`}
                    name="payment_method" 
                    value={method.value}
                    checked={formData.payment_method === method.value}
                    onChange={handleInputChange}
                  />
                  <label htmlFor={`payment_${method.value}`} className="w3-margin-left">
                    <i className={`fa ${method.icon} w3-margin-right`}></i>
                    {method.label}
                  </label>
                </div>
              ))}
            </div>

            {formData.payment_method === 'card' && (
              <div>
                <h4>Szczegóły karty</h4>
                <div className="w3-margin-bottom w3-padding-small">
                  <label className="w3-text-black"><b>Numer karty:</b></label>
                  <input 
                    type="text" 
                    value={formData.payment.card_number}
                    onChange={handleCardNumberChange}
                    className="w3-input w3-border w3-margin-top"
                    placeholder="1234 5678 9012 3456"
                    maxLength="19"
                    required
                  />
                  {errors['payment.card_number'] && <p className="w3-text-red w3-small">{errors['payment.card_number']}</p>}
                </div>

                <div className="w3-margin-bottom w3-padding-small">
                  <label className="w3-text-black"><b>Imię i nazwisko posiadacza karty:</b></label>
                  <input 
                    type="text" 
                    name="payment.card_name"
                    value={formData.payment.card_name}
                    onChange={handleInputChange}
                    className="w3-input w3-border w3-margin-top"
                    placeholder="Jan Kowalski"
                    required
                  />
                  {errors['payment.card_name'] && <p className="w3-text-red w3-small">{errors['payment.card_name']}</p>}
                </div>

                <div className="w3-row">
                  <div className="w3-col s6 w3-padding-small">
                    <label className="w3-text-black"><b>Data ważności:</b></label>
                    <input 
                      type="text" 
                      value={formData.payment.expiry_date}
                      onChange={handleExpiryChange}
                      className="w3-input w3-border w3-margin-top"
                      placeholder="MM/RR"
                      maxLength="5"
                      required
                    />
                    {errors['payment.expiry_date'] && <p className="w3-text-red w3-small">{errors['payment.expiry_date']}</p>}
                  </div>
                  <div className="w3-col s6 w3-padding-small">
                    <label className="w3-text-black"><b>CVV:</b></label>
                    <input 
                      type="text" 
                      name="payment.cvv"
                      value={formData.payment.cvv}
                      onChange={handleInputChange}
                      className="w3-input w3-border w3-margin-top"
                      placeholder="123"
                      maxLength="4"
                      required
                    />
                    {errors['payment.cvv'] && <p className="w3-text-red w3-small">{errors['payment.cvv']}</p>}
                  </div>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="w3-button w3-green w3-padding-large w3-large w3-margin-top"
              disabled={loading}
            >
              {loading ? 'Przetwarzanie...' : 'Złóż zamówienie'}
            </button>
          </form>
        </div>

        <div className="w3-col l3">
          <div className="w3-card w3-padding">
            <h3>Podsumowanie zamówienia</h3>
            
            {cart.map((item) => (
              <div key={item.id} className="w3-row w3-margin-bottom">
                <div className="w3-col s3">
                  <img 
                    src={item.product.images?.[0] ? `http://localhost:8000/storage/products/${item.product.images[0].image_path}` : 'http://localhost:8000/storage/products/default-product.jpg'}
                    alt={item.product.nazwa}
                    style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                  />
                </div>
                <div className="w3-col s9">
                  <small>{item.product.nazwa}</small>
                  {item.selectedSize && <br />}
                  {item.selectedSize && <small className="w3-text-grey">Rozmiar: {item.selectedSize}</small>}
                  {item.selectedColor && <br />}
                  {item.selectedColor && <small className="w3-text-grey">Kolor: {item.selectedColor}</small>}
                  <br />
                  <small className="w3-text-grey">Ilość: {item.quantity}</small>
                  <br />
                  <small><b>{(parseFloat(item.product.cena) * item.quantity).toFixed(2)} zł</b></small>
                </div>
              </div>
            ))}
            
            <hr />
            
            <div className="w3-row w3-margin-bottom">
              <div className="w3-col s8">Wartość produktów:</div>
              <div className="w3-col s4 w3-right-align">{getCartTotal().toFixed(2)} zł</div>
            </div>
            
            <div className="w3-row w3-margin-bottom">
              <div className="w3-col s8">
                Dostawa:
                <small className="w3-text-grey w3-block">
                  {deliveryMethods.find(m => m.value === formData.delivery_method)?.label}
                </small>
              </div>
              <div className="w3-col s4 w3-right-align">
                {getDeliveryPrice() === 0 ? 'Bezpłatnie' : `${getDeliveryPrice().toFixed(2)} zł`}
              </div>
            </div>
            
            <div className="w3-row w3-margin-bottom">
              <div className="w3-col s8">
                Płatność:
                <small className="w3-text-grey w3-block">
                  {paymentMethods.find(m => m.value === formData.payment_method)?.label}
                </small>
              </div>
            </div>
            
            <hr />
            <div className="w3-row">
              <div className="w3-col s6"><b>Razem:</b></div>
              <div className="w3-col s6 w3-right-align"><b>{getTotalWithDelivery().toFixed(2)} zł</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}