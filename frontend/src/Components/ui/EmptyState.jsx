import PropTypes from 'prop-types';
import PageHeading from './PageHeading';

/** A message and one next action. isPage makes it the page's h1, for pages with nothing else. */
export default function EmptyState({ title, text = null, action = null, isPage = false }) {
  return (
    <div className="max-w-prose py-16">
      {isPage ? <PageHeading>{title}</PageHeading> : <h2 className="text-3xl">{title}</h2>}
      {text && <p className="mt-3 text-stone">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string,
  action: PropTypes.node,
  isPage: PropTypes.bool,
};
