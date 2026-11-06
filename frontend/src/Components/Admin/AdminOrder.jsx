import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router';
import { useToast } from '../../Context/useToast';
import { useForm } from '../../hooks/useForm';
import { useResource } from '../../hooks/useResource';
import { saveFile } from '../../lib/api';
import { downloadAdminInvoice, getAdminOrder, markOrderPaid, updateOrderStatus } from '../../lib/admin';
import { hasInvoice } from '../../lib/orders';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Select from '../ui/Select';
import Spinner from '../ui/Spinner';
import { OrderFacts, OrderHistory, OrderItems, OrderMeta, OrderTotals } from '../Shop/OrderParts';

const NEXT_STATUS_LABELS = {
  processing: 'W realizacji',
  shipped: 'Wysłane',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
};

function StatusForm({ order, onChanged }) {
  const [status, setStatus] = useState(order.next_statuses[0]);
  const [note, setNote] = useState('');
  const form = useForm();
  const toast = useToast();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    form.reset();
    form.run(async () => {
      onChanged(await updateOrderStatus(order.id, { status, note: note.trim() || undefined }));
      toast.success('Zmieniono status zamówienia');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <h2 className="text-2xl">Zmień status</h2>
      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zmienić statusu" />
      )}
      <Select
        label="Nowy status"
        options={order.next_statuses.map((value) => ({ value, label: NEXT_STATUS_LABELS[value] ?? value }))}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      />
      <Field
        label="Notatka dla klienta (opcjonalnie)"
        maxLength={255}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button type="submit" loading={form.submitting}>
        Zmień status
      </Button>
    </form>
  );
}

StatusForm.propTypes = {
  order: PropTypes.object.isRequired,
  onChanged: PropTypes.func.isRequired,
};

function OrderView({ initialOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [busy, setBusy] = useState(null);
  const toast = useToast();

  const canMarkPaid =
    order.payment_method !== 'card' && order.payment_status !== 'paid' && order.status !== 'cancelled';

  const handleMarkPaid = async () => {
    setBusy('paid');

    try {
      setOrder(await markOrderPaid(order.id));
      toast.success('Zamówienie jest opłacone');
    } catch (error) {
      if (error.status !== 401) toast.error(error.errors?.payment?.[0] ?? error.message);
    } finally {
      setBusy(null);
    }
  };

  const handleInvoice = async () => {
    setBusy('invoice');

    try {
      saveFile(await downloadAdminInvoice(order.id));
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeading documentTitle={`Zamówienie ${order.order_number}`}>{`Zamówienie ${order.order_number}`}</PageHeading>
      <OrderMeta order={order} />
      <p className="text-stone">
        Klient: {order.customer?.first_name} {order.customer?.last_name}, {order.customer?.email}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {canMarkPaid && (
          <Button variant="secondary" loading={busy === 'paid'} onClick={handleMarkPaid}>
            Oznacz jako opłacone
          </Button>
        )}
        {hasInvoice(order) && (
          <Button variant="secondary" loading={busy === 'invoice'} onClick={handleInvoice}>
            Pobierz fakturę
          </Button>
        )}
        <ButtonLink to="/admin/orders" variant="secondary">
          Wróć do listy
        </ButtonLink>
      </div>

      <div className="mt-10">
        <OrderFacts order={order} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-10">
          <OrderItems items={order.items} />
          <OrderHistory events={order.statusEvents} />
          {order.next_statuses?.length > 0 && <StatusForm key={order.status} order={order} onChanged={setOrder} />}
        </div>
        <div className="lg:self-start">
          <OrderTotals order={order} />
        </div>
      </div>
    </>
  );
}

OrderView.propTypes = {
  initialOrder: PropTypes.object.isRequired,
};

export default function AdminOrder() {
  const { id } = useParams();
  const load = useCallback((signal) => getAdminOrder(id, { signal }), [id]);
  const { data: order, error, loading, reload } = useResource(load, `admin-order:${id}`);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <EmptyState
        isPage
        title={error.status === 404 ? 'Nie znaleziono zamówienia' : 'Nie udało się wczytać zamówienia'}
        text={error.status === 404 ? undefined : error.message}
        action={
          error.status === 404 ? (
            <ButtonLink to="/admin/orders">Wróć do listy</ButtonLink>
          ) : (
            <Button onClick={reload}>Spróbuj ponownie</Button>
          )
        }
      />
    );
  }

  return <OrderView key={order.id} initialOrder={order} />;
}
