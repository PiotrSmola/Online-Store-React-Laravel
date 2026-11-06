import PropTypes from 'prop-types';
import { Link } from 'react-router';
import Spinner from './Spinner';

const BASE =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control font-semibold ' +
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-mist disabled:text-stone';

const VARIANTS = {
  primary: 'bg-pine px-6 text-white hover:bg-ink',
  secondary: 'border border-pine px-6 text-pine hover:bg-mist',
  plain: 'text-pine underline underline-offset-4 hover:text-ink',
};

function classes(variant, block, className) {
  return `${BASE} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`;
}

export default function Button({
  children,
  variant = 'primary',
  block = false,
  loading = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  // A busy button stays enabled, so it keeps keyboard focus while the request runs.
  return (
    <button
      type={type}
      aria-disabled={loading || undefined}
      className={classes(variant, block, className)}
      onClick={(event) => {
        if (loading) event.preventDefault();
        else onClick?.(event);
      }}
      {...props}
    >
      {loading && <Spinner inline />}
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(Object.keys(VARIANTS)),
  block: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit']),
  onClick: PropTypes.func,
};

export function ButtonLink({ children, to, variant = 'primary', block = false, className = '', ...props }) {
  return (
    <Link to={to} className={classes(variant, block, className)} {...props}>
      {children}
    </Link>
  );
}

ButtonLink.propTypes = {
  children: PropTypes.node.isRequired,
  to: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(Object.keys(VARIANTS)),
  block: PropTypes.bool,
  className: PropTypes.string,
};
