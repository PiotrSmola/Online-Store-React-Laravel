import { useState } from 'react';
import PropTypes from 'prop-types';
import { Minus, Plus } from 'lucide-react';
import { MAX_QUANTITY, clampQuantity } from '../../lib/cart';

const STEP_BUTTON =
  'grid size-11 cursor-pointer place-items-center rounded-control text-ink hover:bg-mist ' +
  'aria-disabled:cursor-not-allowed aria-disabled:text-stone aria-disabled:hover:bg-transparent';

/**
 * target names the product for screen readers when a page has several steppers, and max is the
 * stock when it is known. The buttons use aria-disabled at the limits: a disabled button would
 * drop the keyboard focus it holds.
 */
export default function QuantityStepper({ value, onChange, target = '', max = MAX_QUANTITY }) {
  const [draft, setDraft] = useState(null);
  const suffix = target ? `: ${target}` : '';
  const limit = Math.min(max, MAX_QUANTITY);
  const atMin = value <= 1;
  const atMax = value >= limit;

  return (
    <div role="group" aria-label={`Ilość${suffix}`} className="inline-flex items-center">
      <button
        type="button"
        aria-label={`Zmniejsz ilość${suffix}`}
        className={STEP_BUTTON}
        aria-disabled={atMin || undefined}
        onClick={() => {
          if (!atMin) onChange(value - 1);
        }}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`Ilość${suffix}`}
        className="h-11 w-11 rounded-control border border-stone bg-white text-center text-ink"
        value={draft ?? value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 2);
          setDraft(digits);
          if (digits !== '') onChange(Math.min(clampQuantity(digits), Math.max(limit, 1)));
        }}
        onBlur={() => setDraft(null)}
      />
      <button
        type="button"
        aria-label={`Zwiększ ilość${suffix}`}
        className={STEP_BUTTON}
        aria-disabled={atMax || undefined}
        onClick={() => {
          if (!atMax) onChange(value + 1);
        }}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

QuantityStepper.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  target: PropTypes.string,
  max: PropTypes.number,
};
