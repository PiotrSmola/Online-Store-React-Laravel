import { useState } from 'react';
import PropTypes from 'prop-types';
import { Minus, Plus } from 'lucide-react';
import { MAX_QUANTITY, clampQuantity } from '../../lib/cart';

const STEP_BUTTON =
  'grid size-11 cursor-pointer place-items-center rounded-control text-ink hover:bg-mist ' +
  'disabled:cursor-not-allowed disabled:text-stone disabled:hover:bg-transparent';

/** target names the product for screen readers when a page has several steppers. */
export default function QuantityStepper({ value, onChange, target = '' }) {
  const [draft, setDraft] = useState(null);
  const suffix = target ? `: ${target}` : '';

  return (
    <div role="group" aria-label={`Ilość${suffix}`} className="inline-flex items-center">
      <button
        type="button"
        aria-label={`Zmniejsz ilość${suffix}`}
        className={STEP_BUTTON}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
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
          if (digits !== '') onChange(clampQuantity(digits));
        }}
        onBlur={() => setDraft(null)}
      />
      <button
        type="button"
        aria-label={`Zwiększ ilość${suffix}`}
        className={STEP_BUTTON}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
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
};
