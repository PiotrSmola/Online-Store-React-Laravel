import { useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router';
import { useToast } from '../../Context/useToast';
import { useOrder } from '../../hooks/useOrders';
import { usePageTitle } from '../../hooks/usePageTitle';
import { saveFile } from '../../lib/api';
import { canCancelOrder, canPayOrder, cancelOrder, downloadInvoice, hasInvoice } from '../../lib/orders';
import Button, { ButtonLink } from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import Skeleton from '../ui/Skeleton';
import { OrderFacts, OrderHistory, OrderItems, OrderMeta, OrderTotals } from './OrderParts';

function OrderView({ initialOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(null);
  const toast = useToast();

  const handleCancel = async () => {
    setConfirmingCancel(false);
    setBusy('cancel');

    try {
      setOrder(await cancelOrder(order.id));
      toast.success('Zamówienie zostało anulowane');
    } catch (error) {
      if (error.status !== 401) toast.error(error.errors?.status?.[0] ?? error.message);
    } finally {
      setBusy(null);
    }
  };

  const handleInvoice = async () => {
    setBusy('invoice');

    try {
      saveFile(await downloadInvoice(order.id));
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

      <div className="mt-6 flex flex-wrap gap-3">
        {canPayOrder(order) && <ButtonLink to={`/orders/${order.id}/pay`}>Zapłać za zamówienie</ButtonLink>}
        {hasInvoice(order) && (
          <Button variant="secondary" loading={busy === 'invoice'} onClick={handleInvoice}>
            Pobierz fakturę
          </Button>
        )}
        {canCancelOrder(order) && (
          <Button variant="secondary" loading={busy === 'cancel'} onClick={() => setConfirmingCancel(true)}>
            Anuluj zamówienie
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        title="Anulować zamówienie?"
        text="Tej operacji nie można cofnąć."
        confirmLabel="Anuluj zamówienie"
        onConfirm={handleCancel}
        onCancel={() => setConfirmingCancel(false)}
      />

      <div className="mt-10">
        <OrderFacts order={order} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-10">
          <OrderItems items={order.items} />
          <OrderHistory events={order.statusEvents} />
        </div>
        <div className="lg:self-start">
          <OrderTotals order={order} />
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink to="/orders">Moje zamówienia</ButtonLink>
        <ButtonLink to="/products" variant="secondary">
          Kontynuuj zakupy
        </ButtonLink>
      </div>
    </>
  );
}

OrderView.propTypes = {
  initialOrder: PropTypes.object.isRequired,
};

export default function OrderDetail() {
  const { id } = useParams();
  const { data: order, error, loading, reload } = useOrder(id);
  const isMissing = error?.status === 403 || error?.status === 404;

  usePageTitle(loading ? 'Zamówienie' : null);

  return (
    <div className="gutter py-8 lg:py-12">
      {loading && (
        <>
          <Skeleton className="h-12 max-w-xl" />
          <Skeleton className="mt-2 h-6 max-w-xs" />
          <Skeleton className="mt-10 h-48" />
        </>
      )}
      {order && <OrderView key={order.id} initialOrder={order} />}
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
