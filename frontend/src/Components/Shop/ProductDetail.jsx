import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router';
import { useCartActions } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useCategoryProducts, useProduct } from '../../hooks/useCatalog';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatPrice } from '../../lib/format';
import { categoryPath, cleanOptions } from '../../lib/product';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import QuantityStepper from '../ui/QuantityStepper';
import Select from '../ui/Select';
import Skeleton from '../ui/Skeleton';
import Stars from '../ui/Stars';
import ProductGrid from './ProductGrid';
import ProductImage from './ProductImage';

const RELATED_LIMIT = 4;

function Gallery({ images, name }) {
  const [selected, setSelected] = useState(0);

  return (
    <div>
      <ProductImage key={images[selected]?.id ?? 'default'} image={images[selected]} alt={name} priority="high" />
      {images.length > 1 && (
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={`Pokaż zdjęcie ${index + 1} z ${images.length}`}
                aria-pressed={index === selected}
                className="block w-full cursor-pointer"
                onClick={() => setSelected(index)}
              >
                <ProductImage image={image} alt="" thumbnail />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

Gallery.propTypes = {
  images: PropTypes.arrayOf(PropTypes.object).isRequired,
  name: PropTypes.string.isRequired,
};

function BuyForm({ product }) {
  const sizes = useMemo(() => cleanOptions(product.rozmiar), [product.rozmiar]);
  const colors = useMemo(() => cleanOptions(product.kolor), [product.kolor]);
  const [size, setSize] = useState(sizes[0] ?? null);
  const [color, setColor] = useState(colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartActions();
  const toast = useToast();

  const handleSubmit = (event) => {
    event.preventDefault();
    addItem({ product_id: product.id, size, color, quantity });
    toast.success(`Dodano do koszyka: ${product.nazwa}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-5">
      {sizes.length > 0 && (
        <Select label="Rozmiar" options={sizes} value={size} onChange={(event) => setSize(event.target.value)} />
      )}
      {colors.length > 0 && (
        <Select label="Kolor" options={colors} value={color} onChange={(event) => setColor(event.target.value)} />
      )}
      <div>
        <p className="mb-1 font-medium">Ilość</p>
        <QuantityStepper value={quantity} onChange={setQuantity} />
      </div>
      <Button type="submit" block>
        Dodaj do koszyka
      </Button>
    </form>
  );
}

BuyForm.propTypes = {
  product: PropTypes.object.isRequired,
};

function RelatedProducts({ product }) {
  const { data } = useCategoryProducts(product.kategoria, { limit: RELATED_LIMIT + 1 });
  const related = (data?.items ?? []).filter((item) => item.id !== product.id).slice(0, RELATED_LIMIT);

  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-products" className="mt-20">
      <h2 id="related-products" className="mb-6 text-2xl lg:text-3xl">
        Z tej samej kategorii
      </h2>
      <ProductGrid products={related} />
    </section>
  );
}

RelatedProducts.propTypes = {
  product: PropTypes.object.isRequired,
};

function ProductSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <Skeleton className="aspect-[3/4] w-full" />
      <div>
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="mt-4 h-8 w-1/4" />
        <Skeleton className="mt-8 h-32 max-w-prose" />
      </div>
    </div>
  );
}

function ProductView({ product }) {
  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.images ?? []} name={product.nazwa} />
        <div className="lg:sticky lg:top-8 lg:self-start">
          <PageHeading>{product.nazwa}</PageHeading>
          <p className="mt-3 text-2xl font-semibold">{formatPrice(product.cena)}</p>
          <div className="mt-3">
            <Stars rating={product.ocena} />
          </div>
          <p className="mt-6 max-w-prose">{product.opis}</p>
          <BuyForm key={product.id} product={product} />
          <p className="mt-8 text-stone">
            Kategoria:{' '}
            <Link to={categoryPath(product.kategoria)} className="text-pine underline underline-offset-4">
              {product.kategoria}
            </Link>
          </p>
        </div>
      </div>
      <RelatedProducts product={product} />
    </>
  );
}

ProductView.propTypes = {
  product: PropTypes.object.isRequired,
};

export default function ProductDetail() {
  const { id } = useParams();
  const { data: product, error, loading, reload } = useProduct(id);

  usePageTitle(loading ? 'Produkt' : null);

  return (
    <div className="gutter py-8 lg:py-12">
      {loading && <ProductSkeleton />}
      {product && <ProductView key={product.id} product={product} />}
      {error?.status === 404 && (
        <EmptyState
          isPage
          title="Nie znaleziono produktu"
          text="Ten produkt nie jest już dostępny."
          action={<ButtonLink to="/products">Zobacz wszystkie produkty</ButtonLink>}
        />
      )}
      {error && error.status !== 404 && (
        <EmptyState
          isPage
          title="Nie udało się wczytać produktu"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}
    </div>
  );
}
