import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { categoryPath } from '../../lib/product';
import AccountLinks from './AccountLinks';

const LINK = 'inline-block py-1.5 underline-offset-4 hover:text-pine hover:underline';

export default function Footer({ categories }) {
  return (
    <footer className="gutter bg-mist py-12">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <p className="text-3xl font-bold font-stretch-condensed">Sklep</p>

        {categories.length > 0 && (
          <section aria-labelledby="footer-categories">
            <h2 id="footer-categories" className="mb-2 text-xl">
              Kategorie
            </h2>
            <ul>
              {categories.map((category) => (
                <li key={category}>
                  <Link to={categoryPath(category)} className={LINK}>
                    {category}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="footer-shopping">
          <h2 id="footer-shopping" className="mb-2 text-xl">
            Zakupy
          </h2>
          <ul>
            <li>
              <Link to="/products" className={LINK}>
                Wszystkie produkty
              </Link>
            </li>
            <li>
              <Link to="/cart" className={LINK}>
                Koszyk
              </Link>
            </li>
            <li className="[&>*]:block">
              <AccountLinks className={LINK} />
            </li>
          </ul>
        </section>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="mb-2 text-xl">
            Kontakt
          </h2>
          <ul>
            <li>
              <a href="mailto:sklep@example.com" className={LINK}>
                sklep@example.com
              </a>
            </li>
            <li>
              <a href="tel:+44123123" className={LINK}>
                0044 123 123
              </a>
            </li>
          </ul>
          <p className="mt-3 text-stone">Płacisz kartą, przelewem lub w sklepie.</p>
        </section>
      </div>
    </footer>
  );
}

Footer.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
};
