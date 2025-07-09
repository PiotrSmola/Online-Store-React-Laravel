import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useShop } from "../../Context/ShopContext";

export default function CustomerLogin() {
  const { loginCustomer } = useShop();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('http://localhost:8000/api/customer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      console.log('Login response:', data); // Debug

      if (res.ok) {
        console.log('Login successful, customer:', data.customer); // Debug
        loginCustomer(data.customer, data.token);
        navigate('/');
      } else {
        console.error('Login failed:', data); // Debug
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ email: [data.message || 'Nieprawidłowe dane logowania'] });
        }
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setErrors({ email: ['Wystąpił błąd podczas logowania'] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w3-container w3-padding-64">
      <div className="w3-flex" style={{ justifyContent: 'center' }}>
        <div className="w3-col l4 m6 s12 w3-margin-auto">
          <div className="w3-card w3-padding-large">
            <h2 className="w3-center w3-padding-16">Logowanie</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="w3-margin-bottom">
                <label className="w3-text-black"><b>Email:</b></label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  required
                />
                {errors.email && <p className="w3-text-red w3-small">{errors.email[0]}</p>}
              </div>

              <div className="w3-margin-bottom">
                <label className="w3-text-black"><b>Hasło:</b></label>
                <input 
                  type="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w3-input w3-border w3-margin-top"
                  required
                />
                {errors.password && <p className="w3-text-red w3-small">{errors.password[0]}</p>}
              </div>

              <button 
                type="submit" 
                className="w3-button w3-black w3-block w3-padding-large"
                disabled={loading}
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </button>
            </form>

            <div className="w3-center w3-margin-top">
              <p>Nie masz konta? Zostanie utworzone podczas pierwszego zakupu.</p>
              <Link to="/" className="w3-button w3-light-grey">
                Powrót do sklepu
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}