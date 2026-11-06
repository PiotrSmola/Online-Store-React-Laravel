import { Link } from 'react-router';
import { useShopData } from '../../Context/useShopData';
import { categoryPath } from '../../lib/product';
import AccountLinks from './AccountLinks';
import NewsletterForm from './NewsletterForm';

const LINK = 'inline-block py-1.5 underline-offset-4 hover:text-pine hover:underline';

function phoneHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default function Footer() {
  const { categories, config } = useShopData();
  const categoryNames = categories.data ?? [];
  const contact = config.data?.contact;

  return (
    <footer className="gutter bg-mist py-12">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <section aria-labelledby="footer-newsletter">
          <h2 id="footer-newsletter" className="mb-2 text-xl">
            Newsletter
          </h2>
          <NewsletterForm />
        </section>

        {categoryNames.length > 0 && (
          <section aria-labelledby="footer-categories">
            <h2 id="footer-categories" className="mb-2 text-xl">
              Kategorie
            </h2>
            <ul>
              {categoryNames.map((category) => (
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
              <Link to="/new" className={LINK}>
                Nowości
              </Link>
            </li>
            <li>
              <Link to="/sale" className={LINK}>
                Wyprzedaż
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
              <Link to="/contact" className={LINK}>
                Napisz do nas
              </Link>
            </li>
            {contact?.email && (
              <li>
                <a href={`mailto:${contact.email}`} className={LINK}>
                  {contact.email}
                </a>
              </li>
            )}
            {contact?.phone && (
              <li>
                <a href={phoneHref(contact.phone)} className={LINK}>
                  {contact.phone}
                </a>
              </li>
            )}
          </ul>
          {contact?.address && <p className="mt-3 text-stone">{contact.address}</p>}
          {contact?.opening_hours && <p className="text-stone">{contact.opening_hours}</p>}
        </section>
      </div>
    </footer>
  );
}
