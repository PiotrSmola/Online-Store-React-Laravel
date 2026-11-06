import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router';
import { useCartActions } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useProduct } from '../../hooks/useCatalog';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  categoryPath,
  cleanOptions,
  colorOptions,
  findVariant,
  firstBuyableVariant,
  sizeOptions,
  stockText,
} from '../../lib/product';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import QuantityStepper from '../ui/QuantityStepper';
import Select from '../ui/Select';
import Skeleton from '../ui/Skeleton';
import Stars from '../ui/Stars';
import Price from './Price';
import ProductGrid from './ProductGrid';
import ProductImage from './ProductImage';
import ProductLabel from './ProductLabel';
import ProductReviews from './ProductReviews';
import WishlistToggle from './WishlistToggle';

const MAIN_IMAGE_SIZES = '(min-width: 64rem) 50vw, 100vw';
const GALLERY_THUMB_SIZES = '25vw';

function Gallery({ images, name }) {
  const [selected, setSelected] = useState(0);

  return (
    <div>
      <ProductImage
        key={images[selected]?.id ?? 'default'}
        image={images[selected]}
        alt={name}
        priority="high"
        sizes={MAIN_IMAGE_SIZES}
      />
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
                <ProductImage image={image} alt="" thumbnail sizes={GALLERY_THUMB_SIZES} />
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
  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const sizes = useMemo(() => cleanOptions(product.rozmiar), [product.rozmiar]);
  const colors = useMemo(() => cleanOptions(product.kolor), [product.kolor]);
  const first = firstBuyableVariant(variants);
  const [size, setSize] = useState(first?.size || null);
  const [color, setColor] = useState(first?.color || null);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartActions();
  const toast = useToast();

  const variant = findVariant(variants, size, color);
  const stock = variant?.stock ?? 0;

  const handleSizeChange = (event) => {
    const nextSize = event.target.value;
    const stillBuyable = findVariant(variants, nextSize, color)?.stock > 0;

    setSize(nextSize);
    setQuantity(1);
    if (!stillBuyable) {
      const match = variants.find((candidate) => candidate.size === nextSize && candidate.stock > 0);
      if (match) setColor(match.color || null);
    }
  };

  const handleColorChange = (event) => {
    const nextColor = event.target.value;
    const stillBuyable = findVariant(variants, size, nextColor)?.stock > 0;

    setColor(nextColor);
    setQuantity(1);
    if (!stillBuyable) {
      const match = variants.find((candidate) => candidate.color === nextColor && candidate.stock > 0);
      if (match) setSize(match.size || null);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (stock <= 0) return;

    addItem({ product_id: product.id, size, color, quantity });
    toast.success(`Dodano do koszyka: ${product.nazwa}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-5">
      {sizes.length > 0 && (
        <Select
          label="Rozmiar"
          options={sizeOptions(variants, sizes, color)}
          value={size ?? ''}
          onChange={handleSizeChange}
        />
      )}
      {colors.length > 0 && (
        <Select
          label="Kolor"
          options={colorOptions(variants, colors, size)}
          value={color ?? ''}
          onChange={handleColorChange}
        />
      )}
      <p role="status" className={stock > 0 ? 'text-stone' : 'font-medium text-ember'}>
        {stockText(stock)}
      </p>
      {stock > 0 && (
        <div>
          <p className="mb-1 font-medium">Ilość</p>
          <QuantityStepper value={quantity} max={stock} onChange={setQuantity} />
        </div>
      )}
      <Button type="submit" block disabled={stock <= 0}>
        Dodaj do koszyka
      </Button>
    </form>
  );
}

BuyForm.propTypes = {
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
          <div className="mt-3">
            <ProductLabel product={product} />
          </div>
          <Price product={product} className="text-2xl" />
          {product.reviews_count > 0 && (
            <div className="mt-3">
              <Stars rating={product.ocena} />
            </div>
          )}
          <p className="mt-6 max-w-prose whitespace-pre-line">{product.opis}</p>
          <BuyForm product={product} />
          <div className="mt-4">
            <WishlistToggle productId={product.id} />
          </div>
          <p className="mt-6 text-stone">
            Kategoria:{' '}
            <Link to={categoryPath(product.kategoria)} className="text-pine underline underline-offset-4">
              {product.kategoria}
            </Link>
          </p>
        </div>
      </div>

      <ProductReviews product={product} />

      {product.related?.length > 0 && (
        <section aria-labelledby="related-products" className="mt-16">
          <h2 id="related-products" className="mb-6 text-2xl lg:text-3xl">
            Z tej samej kategorii
          </h2>
          <ProductGrid products={product.related} />
        </section>
      )}
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
