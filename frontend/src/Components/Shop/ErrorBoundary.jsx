import { Component } from 'react';
import PropTypes from 'prop-types';
import Button from '../ui/Button';

/** Catches render errors and failed chunk loads. A new resetKey clears the error. */
export default class ErrorBoundary extends Component {
  state = { failedAt: null, hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps({ resetKey }, { failedAt, hasError }) {
    if (!hasError) return null;
    if (failedAt === null) return { failedAt: resetKey };
    return failedAt === resetKey ? null : { failedAt: null, hasError: false };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="gutter max-w-prose py-16">
        <h1 className="text-4xl lg:text-5xl">Nie udało się wyświetlić tej strony</h1>
        <p className="mt-3 text-stone">Odśwież stronę. Jeśli to nie pomoże, wróć tu za chwilę.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Odśwież stronę
        </Button>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  resetKey: PropTypes.string.isRequired,
};
