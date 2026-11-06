import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { useShopData } from '../../Context/useShopData';
import { useProducts } from '../../hooks/useCatalog';
import { categoryPath, HERO_IMAGE_URL } from '../../lib/product';
import { ButtonLink } from '../ui/Button';
import InlineError from '../ui/InlineError';
import PageHeading from '../ui/PageHeading';
import Skeleton from '../ui/Skeleton';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';

const HOME_PRODUCTS = 4;
const NEW_QUERY = { is_new: 1, per_page: HOME_PRODUCTS };
const SALE_QUERY = { on_sale: 1, per_page: HOME_PRODUCTS };

// Two columns on a desktop keep the words very large and the whole list within one screen.
const WORD = 'block py-1 text-[clamp(2.75rem,12vw,7.5rem)] leading-none font-bold font-stretch-condensed lg:text-[8vw]';
// One placeholder per category the shop has today, so the block below does not move when they load.
const SKELETON_WORDS = ['w-1/4', 'w-3/5', 'w-1/3', 'w-2/5', 'w-1/2', 'w-2/3'];

function CategoryWords() {
  const { categories } = useShopData();

  return (
    <nav aria-label="Kategorie produktów" className="mt-6">
      <ul className="lg:columns-2 lg:gap-8">
        {categories.loading &&
          SKELETON_WORDS.map((width) => (
            <li key={width} className={`${WORD} break-inside-avoid`}>
              <Skeleton className={`h-[1em] ${width}`} />
            </li>
          ))}
        {(categories.data ?? []).map((category) => (
          <li key={category} className="break-inside-avoid">
            <Link to={categoryPath(category)} className={`${WORD} hover:text-pine`}>
              {category}
            </Link>
          </li>
        ))}
        <li className="break-inside-avoid">
          <Link to="/products" className={`${WORD} hover:text-pine`}>
            Wszystkie
          </Link>
        </li>
      </ul>
      {categories.error && (
        <InlineError className="mt-4" message="Nie udało się wczytać kategorii." onRetry={categories.reload} />
      )}
    </nav>
  );
}

function ProductSection({ id, title, query, to, linkLabel }) {
  const products = useProducts(query);

  if (products.data?.items.length === 0) return null;

  return (
    <section aria-labelledby={id} className="mt-16">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6">
        <h2 id={id} className="text-2xl lg:text-3xl">
          {title}
        </h2>
        <ButtonLink to={to} variant="plain">
          {linkLabel}
        </ButtonLink>
      </div>
      {products.loading && <ProductGridSkeleton count={HOME_PRODUCTS} />}
      {products.error && <InlineError message="Nie udało się wczytać produktów." onRetry={products.reload} />}
      {products.data && <ProductGrid products={products.data.items} />}
    </section>
  );
}

ProductSection.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  query: PropTypes.object.isRequired,
  to: PropTypes.string.isRequired,
  linkLabel: PropTypes.string.isRequired,
};

export default function Home() {
  return (
    <>
      <img
        src={HERO_IMAGE_URL}
        alt=""
        width="1200"
        height="800"
        fetchPriority="high"
        className="mx-auto aspect-[3/2] w-full max-w-[1500px] bg-mist object-cover object-[70%_30%] lg:aspect-[21/9]"
      />

      <div className="gutter pt-8 pb-16 lg:pt-12">
        <PageHeading documentTitle="Odzież, obuwie i dodatki" className="text-2xl lg:text-3xl">
          Odzież, obuwie i dodatki
        </PageHeading>
        <CategoryWords />
        <ProductSection id="home-new" title="Nowości" query={NEW_QUERY} to="/new" linkLabel="Zobacz wszystkie nowości" />
        <ProductSection id="home-sale" title="Wyprzedaż" query={SALE_QUERY} to="/sale" linkLabel="Zobacz całą wyprzedaż" />
      </div>
    </>
  );
}
