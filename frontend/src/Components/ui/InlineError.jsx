import PropTypes from 'prop-types';
import Button from './Button';

/** A failed part of a page, which the rest of the page can live without. */
export default function InlineError({ message, onRetry, className = '' }) {
  return (
    <div role="alert" className={className}>
      <p className="text-ember">{message}</p>
      <Button variant="plain" onClick={onRetry}>
        Spróbuj ponownie
      </Button>
    </div>
  );
}

InlineError.propTypes = {
  message: PropTypes.string.isRequired,
  onRetry: PropTypes.func.isRequired,
  className: PropTypes.string,
};
