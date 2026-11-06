import { useId } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';
import { ERROR, LABEL, controlClasses } from './controlClasses';

function toOption(option) {
  return typeof option === 'string' ? { value: option, label: option } : option;
}

/** options are strings, or { value, label, disabled } objects. */
export default function Select({ id, label, options, error = null, className = '', ...select }) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={selectId} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${controlClasses(Boolean(error))} cursor-pointer appearance-none pr-10`}
          {...select}
        >
          {options.map(toOption).map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone"
        />
      </div>
      {error && (
        <p id={errorId} className={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

Select.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        value: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        disabled: PropTypes.bool,
      }),
    ]),
  ).isRequired,
  error: PropTypes.string,
  className: PropTypes.string,
};
