import PropTypes from 'prop-types';

/** A still placeholder: motion is kept for responses to the user. Size it like the final content. */
export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`bg-mist ${className}`} />;
}

Skeleton.propTypes = {
  className: PropTypes.string,
};
