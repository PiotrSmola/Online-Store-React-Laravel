import { useState } from 'react';
import { useCartActions, useCartItems } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useCartQuote } from '../../hooks/useCartQuote';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import { lineKey } from '../../lib/cart';
import { formatPrice } from '../../lib/format';
import { freeDeliveryText } from '../../lib/quote';
import Button, { ButtonLink } from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';
import CartLine from './CartLine';

export default function Cart() {
  const items = useCartItems();
  const { clear } = useCartActions();
  const toast = useToast();
  const { data: quote, error, reload } = useCartQuote(items);
  const focusHeading = useFocusPageHeading();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClear = () => {
    setConfirmingClear(false);
    clear();
    toast.success('Koszyk został wyczyszczony');
    focusHeading();
  };

  if (items.length === 0) {
    return (
      <div className="gutter">
        <EmptyState
          isPage
          title="Twój koszyk jest pusty"
          action={<ButtonLink to="/products">Zobacz produkty</ButtonLink>}
        />
      </div>
    );
  }

  const hasUnavailable = quote?.lines.some((line) => !line.available);

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Koszyk</PageHeading>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
        <div>
          <ul className="space-y-8">
            {items.map((item) => (
              <CartLine
                key={lineKey(item)}
                item={item}
                line={quote?.lines.find((line) => line.key === lineKey(item))}
                onRemoved={focusHeading}
              />
            ))}
          </ul>
          <Button variant="plain" className="mt-8" onClick={() => setConfirmingClear(true)}>
            Wyczyść koszyk
          </Button>
          <ConfirmDialog
            open={confirmingClear}
            title="Wyczyścić koszyk?"
            text="Usuniemy z niego wszystkie produkty."
            confirmLabel="Wyczyść koszyk"
            onConfirm={handleClear}
            onCancel={() => setConfirmingClear(false)}
          />
        </div>

        <section aria-labelledby="cart-summary" className="rounded-control bg-mist p-6 lg:sticky lg:top-8 lg:self-start">
          <h2 id="cart-summary" className="text-2xl">
            Podsumowanie
          </h2>

          {error ? (
            <div className="mt-4">
              <p className="text-ember">{error.message}</p>
              <Button variant="secondary" className="mt-4" onClick={reload}>
                Spróbuj ponownie
              </Button>
            </div>
          ) : (
            <p aria-live="polite" className="mt-4 flex items-baseline justify-between gap-4">
              <span>Wartość produktów</span>
              <span className="text-xl font-semibold">{formatPrice(quote?.subtotal)}</span>
            </p>
          )}
          <p className="mt-1 min-h-5 text-sm text-stone">{error ? '' : freeDeliveryText(quote)}</p>
          {hasUnavailable && <p className="mt-4 text-ember">Usuń niedostępne produkty, aby przejść dalej.</p>}

          {!hasUnavailable && (
            <ButtonLink to="/checkout" block className="mt-6">
              Przejdź do zamówienia
            </ButtonLink>
          )}
        </section>
      </div>
    </div>
  );
}
