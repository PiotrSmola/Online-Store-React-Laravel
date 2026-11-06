import { useCallback, useState } from 'react';
import { Heart, Menu, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { useShopData } from '../../Context/useShopData';
import { categoryPath } from '../../lib/product';
import Drawer from '../ui/Drawer';
import AccountLinks from './AccountLinks';
import CartMenu from './CartMenu';
import SearchForm from './SearchForm';

const NAV_LINK = 'inline-flex h-11 items-center rounded-control underline-offset-8 hover:text-pine hover:underline';
const NAV_LINK_ACTIVE = 'text-pine underline';
const ICON_LINK = 'grid size-11 place-items-center rounded-control hover:text-pine';
const DRAWER_WORD = 'block py-1 text-5xl font-bold font-stretch-condensed hover:text-pine';
const DRAWER_LINK = 'block py-3 text-lg font-medium hover:text-pine';

const COLLECTIONS = [
  { to: '/new', label: 'Nowości' },
  { to: '/sale', label: 'Wyprzedaż' },
];

function navClass({ isActive }) {
  return `${NAV_LINK} ${isActive ? NAV_LINK_ACTIVE : ''}`;
}

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const { categories } = useShopData();
  const { status } = useAuth();
  const categoryNames = categories.data ?? [];
  const signedIn = status === AUTH_STATUS.authenticated;

  return (
    <header className="relative z-20 bg-white">
      <div className="gutter flex flex-wrap items-center gap-x-2 gap-y-1 py-2 lg:gap-x-6">
        <button
          type="button"
          aria-label="Otwórz menu"
          aria-haspopup="dialog"
          className="-ml-2.5 grid size-11 cursor-pointer place-items-center rounded-control lg:hidden"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu aria-hidden="true" className="size-6" />
        </button>

        <Link to="/" className="rounded-control text-3xl font-bold font-stretch-condensed">
          Sklep
        </Link>

        <SearchForm className="order-last w-full lg:order-none lg:w-auto lg:max-w-md lg:grow" />

        <div className="ml-auto flex items-center">
          <Link to="/wishlist" aria-label="Lista życzeń" className={ICON_LINK}>
            <Heart aria-hidden="true" className="size-6" />
          </Link>
          <Link to={signedIn ? '/account' : '/login'} aria-label={signedIn ? 'Moje konto' : 'Zaloguj się'} className={ICON_LINK}>
            <UserRound aria-hidden="true" className="size-6" />
          </Link>
          <CartMenu />
        </div>
      </div>

      <nav aria-label="Kategorie" className="gutter hidden pb-1 lg:block">
        <ul className="flex flex-wrap items-center gap-x-5">
          {COLLECTIONS.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} className={navClass}>
                {label}
              </NavLink>
            </li>
          ))}
          <li>
            <NavLink to="/products" className={navClass}>
              Wszystkie
            </NavLink>
          </li>
          {categoryNames.map((category) => (
            <li key={category}>
              <NavLink to={categoryPath(category)} className={navClass}>
                {category}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Drawer open={drawerOpen} onClose={closeDrawer} label="Menu">
        <nav aria-label="Kategorie" className="gutter mt-4">
          <ul>
            {COLLECTIONS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={DRAWER_WORD} onClick={closeDrawer}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/products" className={DRAWER_WORD} onClick={closeDrawer}>
                Wszystkie produkty
              </Link>
            </li>
            {categoryNames.map((category) => (
              <li key={category}>
                <Link to={categoryPath(category)} className={DRAWER_WORD} onClick={closeDrawer}>
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="gutter mt-8 pb-8">
          <Link to="/wishlist" className={DRAWER_LINK} onClick={closeDrawer}>
            Lista życzeń
          </Link>
          <AccountLinks className={DRAWER_LINK} onNavigate={closeDrawer} />
          <Link to="/contact" className={DRAWER_LINK} onClick={closeDrawer}>
            Kontakt
          </Link>
        </div>
      </Drawer>
    </header>
  );
}
