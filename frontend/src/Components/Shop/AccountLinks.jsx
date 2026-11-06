import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { useAuth } from '../../Context/useShop';
import { AUTH_STATUS } from '../../Context/authStatus';

/** Login, or orders and logout. className styles each link and button. */
export default function AccountLinks({ className, onNavigate }) {
  const { status, signOutCustomer } = useAuth();

  if (status === AUTH_STATUS.guest) {
    return (
      <Link to="/login" className={className} onClick={onNavigate}>
        Zaloguj się
      </Link>
    );
  }

  if (status !== AUTH_STATUS.authenticated) return null;

  return (
    <>
      <Link to="/orders" className={className} onClick={onNavigate}>
        Moje zamówienia
      </Link>
      <button
        type="button"
        className={`${className} cursor-pointer text-left`}
        onClick={() => {
          onNavigate?.();
          signOutCustomer();
        }}
      >
        Wyloguj się
      </button>
    </>
  );
}

AccountLinks.propTypes = {
  className: PropTypes.string.isRequired,
  onNavigate: PropTypes.func,
};
