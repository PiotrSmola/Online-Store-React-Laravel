import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router';
import { useOrder } from '../../hooks/useOrders';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { EMPTY_CARD, cardLastFour, formatCardNumber, formatExpiry, validateCard } from '../../lib/cardForm';
import { formatPrice } from '../../lib/format';
import { canPayOrder, payOrder } from '../../lib/orders';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Skeleton from '../ui/Skeleton';

const FIELD_IDS = {
  number: 'card-number',
  name: 'card-name',
  expiry: 'card-expiry',
  cvv: 'card-cvv',
};

/**
 * The simulated card form. The card stays in this component's state: nothing is logged or stored,
 * only the last four digits are sent, and the fields are cleared after every attempt.
 */
function CardForm({ order }) {
  const [card, setCard] = useState(EMPTY_CARD);
  const form = useForm(FIELD_IDS);
  const navigate = useNavigate();

  const update = (field, value) => {
    setCard((current) => ({ ...current, [field]: value }));
    form.setFieldError(field, null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = validateCard(card);
    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    const lastFour = cardLastFour(card.number);
    setCard(EMPTY_CARD);
    form.reset();

    form.run(async () => {
      const paid = await payOrder(order.id, lastFour);
      navigate('/order-success', { replace: true, state: { order: paid } });
    });
  };

  return (
    <form noValidate autoComplete="off" onSubmit={handleSubmit} className="mt-8 max-w-md space-y-5">
      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Płatność się nie powiodła" />
      )}

      <Field
        id={FIELD_IDS.number}
        label="Numer karty"
        required
        autoComplete="off"
        inputMode="numeric"
        maxLength={23}
        spellCheck={false}
        value={card.number}
        error={form.errors.number}
        onChange={(event) => update('number', formatCardNumber(event.target.value))}
      />
      <Field
        id={FIELD_IDS.name}
        label="Imię i nazwisko z karty"
        required
        autoComplete="off"
        maxLength={255}
        spellCheck={false}
        value={card.name}
        error={form.errors.name}
        onChange={(event) => update('name', event.target.value)}
      />
      <div className="grid grid-cols-2 gap-5">
        <Field
          id={FIELD_IDS.expiry}
          label="Data ważności"
          required
          autoComplete="off"
          inputMode="numeric"
          placeholder="MM/RR"
          maxLength={5}
          value={card.expiry}
          error={form.errors.expiry}
          onChange={(event) => update('expiry', formatExpiry(event.target.value))}
        />
        <Field
          id={FIELD_IDS.cvv}
          label="CVV"
          type="password"
          required
          autoComplete="off"
          inputMode="numeric"
          maxLength={4}
          value={card.cvv}
          error={form.errors.cvv}
          onChange={(event) => update('cvv', event.target.value.replace(/\D/g, ''))}
        />
      </div>
      <Button type="submit" block loading={form.submitting}>
        {`Zapłać ${formatPrice(order.total)}`}
      </Button>
    </form>
  );
}

CardForm.propTypes = {
  order: PropTypes.shape({
    id: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }).isRequired,
};

function PaymentView({ order }) {
  if (!canPayOrder(order)) {
    return (
      <EmptyState
        isPage
        title="To zamówienie nie czeka na płatność kartą"
        text={`Status płatności: ${order.payment_status_label}.`}
        action={<ButtonLink to={`/orders/${order.id}`}>Zobacz zamówienie</ButtonLink>}
      />
    );
  }

  return (
    <>
      <PageHeading documentTitle="Płatność testowa">Płatność testowa</PageHeading>
      <p className="mt-3 max-w-prose">
        To symulacja: nie pobieramy pieniędzy, a z formularza wysyłamy tylko cztery ostatnie cyfry karty.
        Nie wpisuj prawdziwej karty.
      </p>
      <p className="mt-2 max-w-prose text-stone">
        Użyj numeru 4242 4242 4242 4242. Karta z końcówką 0002, na przykład 4000 0000 0000 0002, zostanie odrzucona.
      </p>
      <p className="mt-4">
        Zamówienie {order.order_number}, do zapłaty: <span className="font-semibold">{formatPrice(order.total)}</span>
      </p>
      <CardForm order={order} />
    </>
  );
}

PaymentView.propTypes = {
  order: PropTypes.object.isRequired,
};

export default function PaymentPage() {
  const { id } = useParams();
  const { data: order, error, loading, reload } = useOrder(id);
  const isMissing = error?.status === 403 || error?.status === 404;

  usePageTitle(loading ? 'Płatność testowa' : null);

  return (
    <div className="gutter py-8 lg:py-12">
      {loading && (
        <>
          <Skeleton className="h-12 max-w-md" />
          <Skeleton className="mt-8 h-72 max-w-md" />
        </>
      )}
      {order && <PaymentView key={order.id} order={order} />}
      {isMissing && (
        <EmptyState
          isPage
          title="Nie znaleziono zamówienia"
          action={<ButtonLink to="/orders">Moje zamówienia</ButtonLink>}
        />
      )}
      {error && !isMissing && (
        <EmptyState
          isPage
          title="Nie udało się wczytać zamówienia"
          text={error.message}
          action={<Button onClick={reload}>Spróbuj ponownie</Button>}
        />
      )}
    </div>
  );
}
