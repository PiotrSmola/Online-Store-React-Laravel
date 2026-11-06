import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router';
import { useAuth, useCartActions, useCartItems } from '../../Context/useShop';
import { useShopData } from '../../Context/useShopData';
import { useCartQuote } from '../../hooks/useCartQuote';
import { useForm } from '../../hooks/useForm';
import {
  CARD,
  CASH,
  PAYMENT_METHODS,
  PICKUP_POINT,
  STORE_PICKUP,
  buildOrderPayload,
  initialCheckoutForm,
  validateCheckout,
  validateField,
} from '../../lib/checkoutForm';
import { formatPrice } from '../../lib/format';
import { placeOrder } from '../../lib/orders';
import { loginPath } from '../../lib/redirect';
import { verifySession } from '../../lib/session';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Radio from '../ui/Radio';
import Select from '../ui/Select';
import Skeleton from '../ui/Skeleton';
import CheckoutSummary from './CheckoutSummary';

const SHIPPING_PREFIX = 'shipping.';

const SECTION = 'border-0 p-0';
const LEGEND = 'mb-3 text-2xl font-bold font-stretch-condensed';
const ROW = 'grid gap-5 sm:grid-cols-2';

const FIELD_NAMES = [
  'email',
  'password',
  'first_name',
  'last_name',
  'phone',
  'company_name',
  'nip',
  'address',
  'postal_code',
  'city',
  'country',
  'pickup_point',
  'coupon_code',
  'shipping.first_name',
  'shipping.last_name',
  'shipping.company_name',
  'shipping.address',
  'shipping.postal_code',
  'shipping.city',
  'shipping.country',
];

function fieldId(name) {
  return `checkout-${name.replace('.', '-')}`;
}

const FIELD_IDS = Object.fromEntries(FIELD_NAMES.map((name) => [name, fieldId(name)]));

function setField(form, name, value) {
  if (!name.startsWith(SHIPPING_PREFIX)) return { ...form, [name]: value };

  const field = name.slice(SHIPPING_PREFIX.length);
  return { ...form, shipping: { ...form.shipping, [field]: value } };
}

function fieldValue(form, name) {
  return name.startsWith(SHIPPING_PREFIX) ? form.shipping[name.slice(SHIPPING_PREFIX.length)] : form[name];
}

function deliveryPriceText(price) {
  return price === 0 ? 'Bezpłatnie' : formatPrice(price);
}

/** Stock and coupon problems arrive as lists: errors.cart holds one message per line. */
function withoutCartErrors({ cart, ...errors }) {
  return { errors, cartMessage: cart ? [].concat(cart).join(' ') : null };
}

export default function CheckoutForm({ customer = null, onPlaced }) {
  const items = useCartItems();
  const { clear } = useCartActions();
  const { signInWith } = useAuth();
  const { config } = useShopData();
  const navigate = useNavigate();
  const isGuest = !customer;

  const [values, setValues] = useState(() => initialCheckoutForm(customer));
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const form = useForm(FIELD_IDS);

  const quote = useCartQuote(items, { coupon: appliedCoupon, deliveryMethod: values.delivery_method });
  const hasUnavailable = quote.data?.lines.some((line) => !line.available);
  const couponError = quote.data?.coupon_error ?? null;
  const pickupPoints = config.data?.pickup_points ?? [];

  const updateField = (name, value) => {
    setValues((current) => setField(current, name, value));
    form.setFieldError(name, null);
  };

  const handleChange = (event) => updateField(event.target.name, event.target.value);

  const handleBlur = (event) => {
    const { name } = event.target;
    form.setFieldError(name, validateField(name, values, { isGuest }));
  };

  const handleDelivery = (event) => {
    const deliveryMethod = event.target.value;

    setValues((current) => ({
      ...current,
      delivery_method: deliveryMethod,
      payment_method: current.payment_method === CASH && deliveryMethod !== STORE_PICKUP ? CARD : current.payment_method,
    }));
  };

  const applyCoupon = () => setAppliedCoupon(values.coupon_code.trim());

  // Enter here means this code, not the whole order.
  const handleCouponKey = (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    applyCoupon();
  };

  const removeCoupon = () => {
    setAppliedCoupon('');
    updateField('coupon_code', '');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.submitting) return;

    if (!quote.data || quote.loading) {
      form.fail({}, 'Poczekaj na podsumowanie zamówienia albo spróbuj je wczytać ponownie.');
      return;
    }

    if (hasUnavailable) {
      form.fail({}, 'Popraw koszyk: niektóre produkty są niedostępne.');
      return;
    }

    const found = validateCheckout(values, { isGuest });
    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();

    await form.run(async () => {
      try {
        // The orders endpoint treats a dead token as a guest, which would leave this signed-in form
        // with no password field and no way forward. A refused token redirects to login here.
        if (!isGuest) await verifySession();

        const coupon = quote.data.coupon?.code ?? '';
        const result = await placeOrder(buildOrderPayload({ ...values, coupon_code: coupon }, items, { isGuest }));

        onPlaced();
        if (result.token) signInWith(result.customer, result.token);
        clear();

        if (values.payment_method === CARD) navigate(`/orders/${result.order.id}/pay`, { replace: true });
        else navigate('/order-success', { state: { order: result.order } });
      } catch (error) {
        if (error.errors?.cart) {
          const { errors, cartMessage } = withoutCartErrors(error.errors);
          form.fail(errors, cartMessage);
          return;
        }

        throw error;
      }
    });
  };

  const textField = (name, label, props = {}) => (
    <Field
      id={fieldId(name)}
      name={name}
      label={label}
      required
      value={fieldValue(values, name)}
      error={form.errors[name]}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Zamówienie</PageHeading>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <form noValidate onSubmit={handleSubmit} className="max-w-2xl space-y-10">
          {form.failedSubmits > 0 && form.summary.length > 0 && (
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} />
          )}

          <p className="text-stone">
            Wszystkie pola są wymagane, chyba że opis mówi inaczej.
            {isGuest && (
              <>
                {' '}
                Masz już konto?{' '}
                <Link to={loginPath('/checkout')} className="text-pine underline underline-offset-4">
                  Zaloguj się
                </Link>
              </>
            )}
          </p>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Dane klienta</legend>
            <div className="mb-4">
              <Radio
                label="Klient indywidualny"
                name="customer_type"
                value="individual"
                checked={values.customer_type === 'individual'}
                onChange={handleChange}
              />
              <Radio
                label="Firma"
                name="customer_type"
                value="company"
                checked={values.customer_type === 'company'}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-5">
              <div className={ROW}>
                {textField('email', 'E-mail', { type: 'email', autoComplete: 'email', readOnly: !isGuest })}
                {isGuest &&
                  textField('password', 'Hasło', {
                    type: 'password',
                    autoComplete: 'current-password',
                    hint: 'Nowe konto założymy przy zamówieniu. Jeśli już je masz, wpisz swoje hasło.',
                  })}
              </div>
              <div className={ROW}>
                {textField('first_name', 'Imię', { autoComplete: 'given-name', maxLength: 255 })}
                {textField('last_name', 'Nazwisko', { autoComplete: 'family-name', maxLength: 255 })}
              </div>
              {textField('phone', 'Telefon', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
              {values.customer_type === 'company' && (
                <div className={ROW}>
                  {textField('company_name', 'Nazwa firmy', { autoComplete: 'organization', maxLength: 255 })}
                  {textField('nip', 'NIP', { inputMode: 'numeric', maxLength: 20 })}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Adres</legend>
            <div className="space-y-5">
              {textField('address', 'Ulica i numer', { autoComplete: 'street-address', maxLength: 255 })}
              <div className={ROW}>
                {textField('postal_code', 'Kod pocztowy', { autoComplete: 'postal-code', maxLength: 10 })}
                {textField('city', 'Miasto', { autoComplete: 'address-level2', maxLength: 255 })}
              </div>
              {textField('country', 'Kraj', { autoComplete: 'country-name', maxLength: 255 })}
            </div>
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-pine"
                checked={values.separate_shipping}
                onChange={(event) => setValues((current) => ({ ...current, separate_shipping: event.target.checked }))}
              />
              Dostawa na inny adres
            </label>
            {values.separate_shipping && (
              <div className="mt-4 space-y-5">
                <div className={ROW}>
                  {textField('shipping.first_name', 'Imię odbiorcy', { autoComplete: 'shipping given-name', maxLength: 255 })}
                  {textField('shipping.last_name', 'Nazwisko odbiorcy', { autoComplete: 'shipping family-name', maxLength: 255 })}
                </div>
                {textField('shipping.company_name', 'Firma (opcjonalnie)', {
                  autoComplete: 'shipping organization',
                  maxLength: 255,
                  required: false,
                })}
                {textField('shipping.address', 'Ulica i numer dostawy', { autoComplete: 'shipping street-address', maxLength: 255 })}
                <div className={ROW}>
                  {textField('shipping.postal_code', 'Kod pocztowy dostawy', { autoComplete: 'shipping postal-code', maxLength: 10 })}
                  {textField('shipping.city', 'Miasto dostawy', { autoComplete: 'shipping address-level2', maxLength: 255 })}
                </div>
                {textField('shipping.country', 'Kraj dostawy', { autoComplete: 'shipping country-name', maxLength: 255 })}
              </div>
            )}
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Dostawa</legend>
            {!quote.data && !quote.error && <Skeleton className="h-33 max-w-md" />}
            {quote.data?.delivery_options.map((method) => (
              <Radio
                key={method.value}
                label={method.label}
                aside={deliveryPriceText(method.price)}
                name="delivery_method"
                value={method.value}
                checked={values.delivery_method === method.value}
                onChange={handleDelivery}
              />
            ))}
            {values.delivery_method === PICKUP_POINT && (
              <Select
                id={fieldId('pickup_point')}
                className="mt-3"
                label="Paczkomat"
                name="pickup_point"
                required
                options={[
                  { value: '', label: 'Wybierz paczkomat' },
                  ...pickupPoints.map((point) => ({ value: point.code, label: point.address })),
                ]}
                value={values.pickup_point}
                error={form.errors.pickup_point}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            )}
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Płatność</legend>
            {PAYMENT_METHODS.map((method) => {
              const unavailable = method.value === CASH && values.delivery_method !== STORE_PICKUP;

              return (
                <Radio
                  key={method.value}
                  label={method.label}
                  hint={unavailable ? 'Dostępna przy odbiorze w sklepie' : null}
                  disabled={unavailable}
                  name="payment_method"
                  value={method.value}
                  checked={values.payment_method === method.value}
                  onChange={handleChange}
                />
              );
            })}
            {values.payment_method === CARD && (
              <p className="mt-2 max-w-prose text-stone">Dane karty podasz w następnym kroku.</p>
            )}
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Kod rabatowy</legend>
            <div className="flex flex-wrap items-end gap-3">
              {textField('coupon_code', 'Kod (opcjonalnie)', {
                required: false,
                maxLength: 64,
                autoComplete: 'off',
                className: 'min-w-48 grow sm:max-w-xs',
                onBlur: undefined,
                onKeyDown: handleCouponKey,
                error: form.errors.coupon_code ?? couponError,
              })}
              <Button
                variant="secondary"
                className={couponError || form.errors.coupon_code ? 'mb-6' : ''}
                onClick={applyCoupon}
              >
                Zastosuj kod
              </Button>
            </div>
            {quote.data?.coupon && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-pine">
                Kod zastosowany: {quote.data.coupon.label}
                <Button variant="plain" onClick={removeCoupon}>
                  Usuń kod
                </Button>
              </p>
            )}
          </fieldset>

          <div>
            {/* The summary sits below the form on small screens, and the total must be seen before ordering. */}
            <p className="mb-3 flex justify-between gap-4 text-xl font-semibold lg:hidden">
              <span>Razem</span>
              <span>{formatPrice(quote.data?.total)}</span>
            </p>
            <Button type="submit" loading={form.submitting} className="w-full sm:w-auto">
              Złóż zamówienie
            </Button>
          </div>
        </form>

        <CheckoutSummary items={items} quote={quote} deliveryMethod={values.delivery_method} />
      </div>
    </div>
  );
}

CheckoutForm.propTypes = {
  customer: PropTypes.object,
  onPlaced: PropTypes.func.isRequired,
};
