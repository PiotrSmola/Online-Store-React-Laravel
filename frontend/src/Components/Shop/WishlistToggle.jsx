import PropTypes from 'prop-types';
import { Heart } from 'lucide-react';
import { useLocation } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useWishlistItem } from '../../hooks/useWishlistItem';
import { loginPath } from '../../lib/redirect';
import Button, { ButtonLink } from '../ui/Button';

export default function WishlistToggle({ productId }) {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const toast = useToast();
  const signedIn = status === AUTH_STATUS.authenticated;
  const { saved, loading, busy, toggle } = useWishlistItem(productId, { enabled: signedIn });

  if (!signedIn) {
    return (
      <ButtonLink to={loginPath(pathname)} variant="plain">
        <Heart aria-hidden="true" className="size-5" />
        Zaloguj się, aby zapisać na liście życzeń
      </ButtonLink>
    );
  }

  const handleClick = async () => {
    try {
      const nowSaved = await toggle();
      toast.success(nowSaved ? 'Dodano do listy życzeń' : 'Usunięto z listy życzeń');
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
  };

  return (
    <Button variant="plain" aria-pressed={saved} loading={loading || busy} onClick={handleClick}>
      <Heart aria-hidden="true" className={`size-5 ${saved ? 'fill-pine' : ''}`} />
      {saved ? 'Na liście życzeń' : 'Dodaj do listy życzeń'}
    </Button>
  );
}

WishlistToggle.propTypes = {
  productId: PropTypes.number.isRequired,
};
