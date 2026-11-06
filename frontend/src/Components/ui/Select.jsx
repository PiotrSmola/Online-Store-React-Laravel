import { useId } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';
import { ERROR, LABEL, controlClasses } from './controlClasses';

export default function Select({ label, options, error = null, className = '', ...select }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`${controlClasses(Boolean(error))} cursor-pointer appearance-none pr-10`}
          {...select}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
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
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  error: PropTypes.string,
  className: PropTypes.string,
};
