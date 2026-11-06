import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { categoryPath } from '../../lib/product';
import Drawer from '../ui/Drawer';
import AccountLinks from './AccountLinks';
import CartMenu from './CartMenu';

const NAV_LINK = 'inline-flex h-11 items-center rounded-control underline-offset-8 hover:text-pine hover:underline';
const NAV_LINK_ACTIVE = 'text-pine underline';
const DRAWER_WORD = 'block py-1 text-5xl font-bold font-stretch-condensed hover:text-pine';
const DRAWER_ACCOUNT = 'block py-3 text-lg font-medium hover:text-pine';

function navClass({ isActive }) {
  return `${NAV_LINK} ${isActive ? NAV_LINK_ACTIVE : ''}`;
}

export default function Header({ categories }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <header className="gutter relative z-20 flex h-16 items-center gap-2 bg-white lg:gap-8">
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

      <nav aria-label="Kategorie" className="hidden lg:block">
        <ul className="flex flex-wrap items-center gap-x-5">
          <li>
            <NavLink to="/products" className={navClass}>
              Wszystkie
            </NavLink>
          </li>
          {categories.map((category) => (
            <li key={category}>
              <NavLink to={categoryPath(category)} className={navClass}>
                {category}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden items-center gap-4 lg:flex">
          <AccountLinks className={NAV_LINK} />
        </div>
        <CartMenu />
      </div>

      <Drawer open={drawerOpen} onClose={closeDrawer} label="Menu">
        <nav aria-label="Kategorie" className="gutter mt-4">
          <ul>
            <li>
              <Link to="/products" className={DRAWER_WORD} onClick={closeDrawer}>
                Wszystkie produkty
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category}>
                <Link to={categoryPath(category)} className={DRAWER_WORD} onClick={closeDrawer}>
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="gutter mt-8 pb-8">
          <AccountLinks className={DRAWER_ACCOUNT} onNavigate={closeDrawer} />
        </div>
      </Drawer>
    </header>
  );
}

Header.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
};
