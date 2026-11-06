import { useRef } from 'react';
import PropTypes from 'prop-types';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useRouteFocus } from '../../hooks/useRouteFocus';

/** The page's h1. It sets the document title and receives focus after a route change. */
export default function PageHeading({ children, documentTitle, className = 'text-4xl lg:text-5xl' }) {
  const heading = useRef(null);

  usePageTitle(documentTitle ?? children);
  useRouteFocus(heading);

  return (
    <h1 ref={heading} tabIndex={-1} className={`outline-none ${className}`}>
      {children}
    </h1>
  );
}

PageHeading.propTypes = {
  children: PropTypes.string.isRequired,
  documentTitle: PropTypes.string,
  className: PropTypes.string,
};
