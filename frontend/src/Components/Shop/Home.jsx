import { Link, useOutletContext } from 'react-router';
import { useProducts } from '../../hooks/useCatalog';
import { categoryPath, HERO_IMAGE_URL } from '../../lib/product';
import PageHeading from '../ui/PageHeading';
import Skeleton from '../ui/Skeleton';
import ProductGrid, { ProductGridSkeleton } from './ProductGrid';

const HOME_PRODUCTS = 4;
const WORD = 'block py-1 text-[clamp(3rem,13vw,11rem)] leading-none font-bold font-stretch-condensed';
const SKELETON_WORDS = ['w-1/4', 'w-3/5', 'w-1/3', 'w-2/5', 'w-1/2', 'w-2/3'];

function CategoryWords() {
  const categories = useOutletContext();

  return (
    <nav aria-label="Kategorie produktów" className="mt-6">
      <ul>
        {categories.loading &&
          SKELETON_WORDS.map((width) => (
            <li key={width} className={WORD}>
              <Skeleton className={`h-[1em] ${width}`} />
            </li>
          ))}
        {(categories.data ?? []).map((category) => (
          <li key={category}>
            <Link to={categoryPath(category)} className={`${WORD} hover:text-pine`}>
              {category}
            </Link>
          </li>
        ))}
        {!categories.loading && (
          <li>
            <Link to="/products" className={`${WORD} hover:text-pine`}>
              Wszystkie produkty
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default function Home() {
  const products = useProducts({ limit: HOME_PRODUCTS });

  return (
    <>
      <img
        src={HERO_IMAGE_URL}
        alt=""
        width="1200"
        height="800"
        fetchPriority="high"
        className="aspect-[3/2] w-full bg-mist object-cover object-[70%_30%] lg:aspect-[21/9]"
      />

      <div className="gutter pt-8 pb-16 lg:pt-12">
        <PageHeading documentTitle="Odzież, obuwie i dodatki" className="text-2xl lg:text-3xl">
          Odzież, obuwie i dodatki
        </PageHeading>
        <CategoryWords />

        {!products.error && (
          <section aria-labelledby="home-products" className="mt-20">
            <h2 id="home-products" className="mb-6 text-2xl lg:text-3xl">
              Nowe produkty
            </h2>
            {products.loading ? (
              <ProductGridSkeleton count={HOME_PRODUCTS} />
            ) : (
              <ProductGrid products={products.data?.items ?? []} />
            )}
          </section>
        )}
      </div>
    </>
  );
}
