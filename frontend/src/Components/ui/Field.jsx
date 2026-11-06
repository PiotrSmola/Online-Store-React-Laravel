import { useId } from 'react';
import PropTypes from 'prop-types';
import { ERROR, HINT, LABEL, controlClasses } from './controlClasses';

/** A labelled input, or a textarea with multiline. Other props go to the control. */
export default function Field({ id, label, error = null, hint = null, multiline = false, className = '', ...input }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : null;
  const errorId = error ? `${fieldId}-error` : null;
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={LABEL}>
        {label}
      </label>
      <Control
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`${controlClasses(Boolean(error))} read-only:bg-mist ${multiline ? 'py-2' : ''}`}
        {...input}
      />
      {hint && (
        <p id={hintId} className={HINT}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

Field.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string.isRequired,
  error: PropTypes.string,
  hint: PropTypes.string,
  multiline: PropTypes.bool,
  className: PropTypes.string,
};
