import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router';
import { useAuth, useCartActions, useCartItems } from '../../Context/useShop';
import { useCartQuote } from '../../hooks/useCartQuote';
import { buildOrderPayload, formatCardNumber, formatExpiry, initialCheckoutForm, validateCheckout, validateField } from '../../lib/checkoutForm';
import { formatPrice } from '../../lib/format';
import { placeOrder } from '../../lib/orders';
import { loginPath } from '../../lib/redirect';
import { DELIVERY_METHODS, PAYMENT_METHODS } from '../../lib/shopConfig';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Radio from '../ui/Radio';
import CheckoutSummary from './CheckoutSummary';

const PAYMENT_PREFIX = 'payment.';
const CASH = 'cash';
const STORE_PICKUP = 'store_pickup';

const SECTION = 'border-0 p-0';
const LEGEND = 'mb-3 text-2xl font-bold font-stretch-condensed';
const ROW = 'grid gap-5 sm:grid-cols-2';

const TEXT_FIELDS = new Set([
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
  'payment.card_number',
  'payment.card_name',
  'payment.expiry_date',
  'payment.cvv',
]);

function fieldId(name) {
  return `checkout-${name.replace('.', '-')}`;
}

function firstMessage(message) {
  return Array.isArray(message) ? message[0] : message;
}

function setField(form, name, value) {
  if (!name.startsWith(PAYMENT_PREFIX)) return { ...form, [name]: value };

  const field = name.slice(PAYMENT_PREFIX.length);
  return { ...form, payment: { ...form.payment, [field]: value } };
}

function deliveryPriceText(price) {
  return price === 0 ? 'Bezpłatnie' : formatPrice(price);
}

export default function CheckoutForm({ customer = null, onPlaced }) {
  const items = useCartItems();
  const { clear } = useCartActions();
  const { signInWith } = useAuth();
  const navigate = useNavigate();
  const isGuest = !customer;

  const [form, setForm] = useState(() => initialCheckoutForm(customer));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const quote = useCartQuote(items, { deliveryMethod: form.delivery_method });
  const hasUnavailable = quote.data?.lines.some((line) => !line.available);

  const updateField = (name, value) => {
    setForm((current) => setField(current, name, value));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleChange = (event) => updateField(event.target.name, event.target.value);

  const handleBlur = (event) => {
    const { name } = event.target;
    const message = validateField(name, form, { isGuest });
    setErrors((current) => ({ ...current, [name]: message ?? undefined }));
  };

  const handleDelivery = (event) => {
    const deliveryMethod = event.target.value;

    setForm((current) => ({
      ...current,
      delivery_method: deliveryMethod,
      payment_method:
        current.payment_method === CASH && deliveryMethod !== STORE_PICKUP ? 'card' : current.payment_method,
    }));
  };

  const fail = (fieldErrors, message = null) => {
    setErrors(fieldErrors);
    setFormError(message);
    setFailedSubmits((count) => count + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (hasUnavailable) {
      fail({}, 'Usuń z koszyka niedostępne produkty.');
      return;
    }

    const found = validateCheckout(form, { isGuest });
    if (Object.keys(found).length > 0) {
      fail(found);
      return;
    }

    setSubmitting(true);

    try {
      const result = await placeOrder(buildOrderPayload(form, items, { isGuest }));

      onPlaced();
      if (result.token) signInWith(result.customer, result.token);
      clear();
      navigate('/order-success', { state: { order: result.order } });
    } catch (error) {
      const hasFieldErrors = Object.keys(error.errors ?? {}).length > 0;
      fail(error.errors ?? {}, hasFieldErrors ? null : error.message);
      setSubmitting(false);
    }
  };

  const textField = (name, label, props = {}) => (
    <Field
      id={fieldId(name)}
      name={name}
      label={label}
      required
      value={name.startsWith(PAYMENT_PREFIX) ? form.payment[name.slice(PAYMENT_PREFIX.length)] : form[name]}
      error={firstMessage(errors[name])}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );

  const summary = [
    ...Object.entries(errors)
      .filter(([, message]) => message)
      .map(([name, message]) => ({
        id: TEXT_FIELDS.has(name) ? fieldId(name) : undefined,
        message: firstMessage(message),
      })),
    ...(formError ? [{ message: formError }] : []),
  ];

  const deliveryOptions = quote.data?.delivery_options ?? DELIVERY_METHODS;

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Zamówienie</PageHeading>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <form noValidate onSubmit={handleSubmit} className="max-w-2xl space-y-10">
          {failedSubmits > 0 && summary.length > 0 && <ErrorSummary errors={summary} focusKey={failedSubmits} />}

          <p className="text-stone">
            Wszystkie pola są wymagane.
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
                checked={form.customer_type === 'individual'}
                onChange={handleChange}
              />
              <Radio
                label="Firma"
                name="customer_type"
                value="company"
                checked={form.customer_type === 'company'}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-5">
              <div className={ROW}>
                {textField('email', 'E-mail', { type: 'email', autoComplete: 'email', readOnly: !isGuest })}
                {isGuest &&
                  textField('password', 'Hasło', {
                    type: 'password',
                    autoComplete: 'new-password',
                    hint: 'Założymy konto, w którym sprawdzisz zamówienie.',
                  })}
              </div>
              <div className={ROW}>
                {textField('first_name', 'Imię', { autoComplete: 'given-name', maxLength: 255 })}
                {textField('last_name', 'Nazwisko', { autoComplete: 'family-name', maxLength: 255 })}
              </div>
              {textField('phone', 'Telefon', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
              {form.customer_type === 'company' && (
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
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Dostawa</legend>
            {deliveryOptions.map((method) => (
              <Radio
                key={method.value}
                label={method.label}
                aside={deliveryPriceText(method.price)}
                name="delivery_method"
                value={method.value}
                checked={form.delivery_method === method.value}
                onChange={handleDelivery}
              />
            ))}
          </fieldset>

          <fieldset className={SECTION}>
            <legend className={LEGEND}>Płatność</legend>
            {PAYMENT_METHODS.map((method) => {
              const unavailable = method.value === CASH && form.delivery_method !== STORE_PICKUP;

              return (
                <Radio
                  key={method.value}
                  label={method.label}
                  hint={unavailable ? 'Dostępna przy odbiorze w sklepie' : null}
                  disabled={unavailable}
                  name="payment_method"
                  value={method.value}
                  checked={form.payment_method === method.value}
                  onChange={handleChange}
                />
              );
            })}

            {form.payment_method === 'card' && (
              <div className="mt-4 space-y-5">
                {textField('payment.card_number', 'Numer karty', {
                  autoComplete: 'off',
                  inputMode: 'numeric',
                  maxLength: 23,
                  spellCheck: false,
                  onChange: (event) => updateField('payment.card_number', formatCardNumber(event.target.value)),
                })}
                {textField('payment.card_name', 'Imię i nazwisko z karty', {
                  autoComplete: 'off',
                  maxLength: 255,
                  spellCheck: false,
                })}
                <div className={ROW}>
                  {textField('payment.expiry_date', 'Data ważności', {
                    autoComplete: 'off',
                    inputMode: 'numeric',
                    placeholder: 'MM/RR',
                    maxLength: 5,
                    onChange: (event) => updateField('payment.expiry_date', formatExpiry(event.target.value)),
                  })}
                  {textField('payment.cvv', 'CVV', {
                    type: 'password',
                    autoComplete: 'off',
                    inputMode: 'numeric',
                    maxLength: 4,
                  })}
                </div>
              </div>
            )}
          </fieldset>

          <div>
            {/* The summary sits below the form on small screens, and the total must be seen before paying. */}
            <p className="mb-3 flex justify-between gap-4 text-xl font-semibold lg:hidden">
              <span>Razem</span>
              <span>{formatPrice(quote.data?.total)}</span>
            </p>
            <Button type="submit" loading={submitting} className="w-full sm:w-auto">
              Złóż zamówienie
            </Button>
          </div>
        </form>

        <CheckoutSummary items={items} quote={quote} deliveryMethod={form.delivery_method} />
      </div>
    </div>
  );
}

CheckoutForm.propTypes = {
  customer: PropTypes.object,
  onPlaced: PropTypes.func.isRequired,
};
