import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router';
import { useShopData } from '../../Context/useShopData';
import { useToast } from '../../Context/useToast';
import { useForm } from '../../hooks/useForm';
import { useResource } from '../../hooks/useResource';
import { createProduct, getAdminProduct, updateProduct } from '../../lib/admin';
import { buildProductPayload, emptyProduct, emptyVariant, productToForm, validateProduct } from '../../lib/productForm';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Spinner from '../ui/Spinner';
import ProductImages from './ProductImages';
import { LINK } from './AdminParts';

const FIELD_IDS = {
  nazwa: 'product-nazwa',
  kategoria: 'product-kategoria',
  cena: 'product-cena',
  sale_price: 'product-sale_price',
  opis: 'product-opis',
};

const CATEGORY_LIST = 'product-categories';

function VariantRow({ variant, index, errors, onChange, onRemove, canRemove }) {
  const number = index + 1;

  return (
    <li className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
      <Field
        label={`Rozmiar ${number}`}
        value={variant.size}
        maxLength={255}
        error={errors[`variants.${index}.size`]}
        onChange={(event) => onChange(variant.key, 'size', event.target.value)}
      />
      <Field
        label={`Kolor ${number}`}
        value={variant.color}
        maxLength={255}
        error={errors[`variants.${index}.color`]}
        onChange={(event) => onChange(variant.key, 'color', event.target.value)}
      />
      <Field
        label={`Stan ${number}`}
        inputMode="numeric"
        required
        value={variant.stock}
        error={errors[`variants.${index}.stock`] ?? errors[`variants.${index}.original_stock`]}
        hint={variant.original_stock === null ? 'Nowy wariant' : `Wczytano: ${variant.original_stock}`}
        onChange={(event) => onChange(variant.key, 'stock', event.target.value)}
      />
      <Button
        variant="plain"
        className="sm:mt-7"
        disabled={!canRemove}
        aria-label={`Usuń wariant ${number}`}
        onClick={() => onRemove(variant.key)}
      >
        Usuń
      </Button>
    </li>
  );
}

VariantRow.propTypes = {
  variant: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  errors: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool.isRequired,
};

function ProductEditor({ product = null }) {
  const { categories } = useShopData();
  const [values, setValues] = useState(() => (product ? productToForm(product) : emptyProduct()));
  const form = useForm(FIELD_IDS);
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    form.setFieldError(name, null);
  };

  const changeVariant = (key, field, value) => {
    setValues((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.key === key ? { ...variant, [field]: value } : variant)),
    }));
  };

  const removeVariant = (key) => {
    setValues((current) => ({ ...current, variants: current.variants.filter((variant) => variant.key !== key) }));
  };

  const addVariant = () => {
    setValues((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = validateProduct(values);
    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();
    form.run(async () => {
      const payload = buildProductPayload(values);

      if (product) {
        // The response holds the real stock, which orders may have changed meanwhile.
        setValues(productToForm(await updateProduct(product.id, payload)));
        toast.success('Zapisano produkt');
        return;
      }

      const created = await createProduct(payload);
      toast.success('Dodano produkt. Teraz możesz dodać zdjęcia');
      navigate(`/admin/products/${created.id}`, { replace: true });
    });
  };

  const textField = (name, label, props) => (
    <Field
      id={FIELD_IDS[name]}
      name={name}
      label={label}
      value={values[name]}
      error={form.errors[name]}
      onChange={handleChange}
      {...props}
    />
  );

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6 max-w-3xl space-y-5">
      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zapisać produktu" />
      )}

      {textField('nazwa', 'Nazwa', { required: true, maxLength: 255 })}
      {textField('kategoria', 'Kategoria', { required: true, maxLength: 255, list: CATEGORY_LIST, autoComplete: 'off' })}
      <datalist id={CATEGORY_LIST}>
        {(categories.data ?? []).map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <div className="grid gap-5 sm:grid-cols-2">
        {textField('cena', 'Cena (zł)', { required: true, inputMode: 'decimal' })}
        {textField('sale_price', 'Cena promocyjna (zł, opcjonalnie)', {
          inputMode: 'decimal',
          hint: 'Puste pole kończy wyprzedaż.',
        })}
      </div>

      {textField('opis', 'Opis', { required: true, multiline: true, rows: 6, maxLength: 20000 })}

      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="is_active" className="size-5 accent-pine" checked={values.is_active} onChange={handleChange} />
          Widoczny w sklepie
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="is_new" className="size-5 accent-pine" checked={values.is_new} onChange={handleChange} />
          Oznacz jako nowość
        </label>
      </div>

      <fieldset className="border-0 p-0">
        <legend className="mb-1 text-2xl font-bold font-stretch-condensed">Warianty</legend>
        <p className="mb-4 max-w-prose text-stone">
          Stan zapisujemy jako różnicę, więc zamówienia złożone w czasie edycji pozostają policzone. Po zapisie
          zobaczysz prawdziwy stan.
        </p>
        <ul className="space-y-4">
          {values.variants.map((variant, index) => (
            <VariantRow
              key={variant.key}
              variant={variant}
              index={index}
              errors={form.errors}
              onChange={changeVariant}
              onRemove={removeVariant}
              canRemove={values.variants.length > 1}
            />
          ))}
        </ul>
        <Button variant="secondary" className="mt-4" onClick={addVariant}>
          Dodaj wariant
        </Button>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={form.submitting}>
          Zapisz produkt
        </Button>
        <ButtonLink to="/admin/products" variant="secondary">
          Wróć do listy
        </ButtonLink>
      </div>
    </form>
  );
}

ProductEditor.propTypes = {
  product: PropTypes.object,
};

function ExistingProduct({ id }) {
  const load = useCallback((signal) => getAdminProduct(id, { signal }), [id]);
  const { data, error, loading, reload } = useResource(load, `admin-product:${id}`);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <EmptyState
        isPage
        title={error.status === 404 ? 'Nie znaleziono produktu' : 'Nie udało się wczytać produktu'}
        text={error.status === 404 ? undefined : error.message}
        action={
          error.status === 404 ? (
            <ButtonLink to="/admin/products">Wróć do listy</ButtonLink>
          ) : (
            <Button onClick={reload}>Spróbuj ponownie</Button>
          )
        }
      />
    );
  }

  return (
    <>
      <PageHeading documentTitle={`Edycja: ${data.nazwa}`}>{`Edycja: ${data.nazwa}`}</PageHeading>
      <p className="mt-2">
        <Link to={`/product/${data.id}`} className={LINK}>
          Zobacz w sklepie
        </Link>
      </p>
      <ProductEditor product={data} />
      <ProductImages productId={data.id} initialImages={data.images ?? []} name={data.nazwa} />
    </>
  );
}

ExistingProduct.propTypes = {
  id: PropTypes.string.isRequired,
};

export default function AdminProductForm() {
  const { id } = useParams();

  if (id) return <ExistingProduct key={id} id={id} />;

  return (
    <>
      <PageHeading>Nowy produkt</PageHeading>
      <ProductEditor />
    </>
  );
}
