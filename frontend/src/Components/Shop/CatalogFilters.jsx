import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { SORT_OPTIONS, hasActiveFilters, isValidPrice } from '../../lib/catalogQuery';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Select from '../ui/Select';

const PRICE_DEBOUNCE_MS = 500;

function withAll(label, values = []) {
  return [{ value: '', label }, ...values];
}

/** A price field that applies a valid value after typing stops, not on every keystroke. */
function PriceField({ label, value, onCommit, placeholder }) {
  const [text, setText] = useState(value);
  const [known, setKnown] = useState(value);
  const typed = useDebouncedValue(text, PRICE_DEBOUNCE_MS);
  const valid = text === '' || isValidPrice(text);

  if (known !== value) {
    setKnown(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value || !valid) return undefined;

    const timer = setTimeout(() => onCommit(text), PRICE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, valid, onCommit]);

  return (
    <Field
      label={label}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      error={!valid && typed === text ? 'Wpisz cenę, na przykład 49.99' : null}
      onChange={(event) => setText(event.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
    />
  );
}

PriceField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onCommit: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

/** Sort and filters. The URL holds their state: see readCatalogQuery. */
export default function CatalogFilters({ query, filters, onChange }) {
  const sortValue = query.sort || 'newest';
  const price = filters?.price;

  return (
    <div className="mb-8">
      <form
        aria-label="Sortowanie i filtry"
        className="grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-3 xl:grid-cols-5"
        onSubmit={(event) => event.preventDefault()}
      >
        <Select
          label="Sortuj"
          options={SORT_OPTIONS}
          value={sortValue}
          onChange={(event) => onChange({ sort: event.target.value === 'newest' ? '' : event.target.value })}
        />
        <Select
          label="Rozmiar"
          options={withAll('Wszystkie', filters?.sizes)}
          value={query.size}
          onChange={(event) => onChange({ size: event.target.value })}
        />
        <Select
          label="Kolor"
          options={withAll('Wszystkie', filters?.colors)}
          value={query.color}
          onChange={(event) => onChange({ color: event.target.value })}
        />
        <PriceField
          label="Cena od"
          value={query.min_price}
          placeholder={price?.min != null ? String(Math.floor(price.min)) : undefined}
          onCommit={(value) => onChange({ min_price: value })}
        />
        <PriceField
          label="Cena do"
          value={query.max_price}
          placeholder={price?.max != null ? String(Math.ceil(price.max)) : undefined}
          onCommit={(value) => onChange({ max_price: value })}
        />
      </form>
      {hasActiveFilters(query) && (
        <Button
          variant="plain"
          className="mt-2"
          onClick={() => onChange({ q: '', size: '', color: '', min_price: '', max_price: '' })}
        >
          Wyczyść filtry
        </Button>
      )}
    </div>
  );
}

CatalogFilters.propTypes = {
  query: PropTypes.object.isRequired,
  filters: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};
