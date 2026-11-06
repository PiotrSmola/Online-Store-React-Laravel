import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Lists a form's errors and takes focus each time focusKey changes, that is on every failed
 * submit. An entry with an id links to its field.
 */
export default function ErrorSummary({ errors, focusKey, title = 'Popraw dane w formularzu' }) {
  const summary = useRef(null);

  useEffect(() => {
    summary.current?.focus();
  }, [focusKey]);

  return (
    <div ref={summary} tabIndex={-1} className="rounded-control bg-mist p-4">
      <h2 className="text-xl text-ember">{title}</h2>
      <ul className="mt-2 space-y-1">
        {errors.map(({ id, message }) => (
          <li key={`${id}-${message}`}>
            {id ? (
              <a
                href={`#${id}`}
                className="text-ember underline underline-offset-4"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(id)?.focus();
                }}
              >
                {message}
              </a>
            ) : (
              <span className="text-ember">{message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

ErrorSummary.propTypes = {
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      message: PropTypes.string.isRequired,
    }),
  ).isRequired,
  focusKey: PropTypes.number.isRequired,
  title: PropTypes.string,
};
