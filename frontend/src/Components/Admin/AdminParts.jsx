import { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { LABEL, controlClasses } from '../ui/controlClasses';
import Pagination from '../ui/Pagination';
import Spinner from '../ui/Spinner';

export const TH = 'pb-2 pr-6 text-left text-sm font-semibold text-stone';
export const TD = 'py-2 pr-6 align-top';
export const LINK = 'text-pine underline underline-offset-4';

const SEARCH_DEBOUNCE_MS = 350;

/** A wide table scrolls inside this box, so the page itself never scrolls sideways. */
export function TableRegion({ label, children }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto">
      <table className="w-full min-w-xl border-collapse">{children}</table>
    </div>
  );
}

TableRegion.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

/** A search field that follows typing, with its timer cleared on cleanup. */
export function SearchBox({ label, value, onChange }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [known, setKnown] = useState(value);

  if (known !== value) {
    setKnown(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return undefined;

    const timer = setTimeout(() => onChange(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className="max-w-sm grow">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="search"
          autoComplete="off"
          className={`${controlClasses(false)} pr-10`}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-stone" />
      </div>
    </div>
  );
}

SearchBox.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

/** The states every list shares: loading, failure, empty, then children and the pages. */
export function ListBody({ list, emptyTitle, children }) {
  const { data, error, loading, reload, hrefFor } = list;
  const focusHeading = useFocusPageHeading();

  if (loading && !data) return <Spinner />;

  if (error) {
    return (
      <EmptyState
        title="Nie udało się wczytać listy"
        text={error.message}
        action={<Button onClick={reload}>Spróbuj ponownie</Button>}
      />
    );
  }

  if (data?.items.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div aria-busy={loading}>
      <p role="status" className="mb-4 text-stone">
        Pozycji: {data.total}
      </p>
      {children}
      <div className="mt-8">
        <Pagination page={data.page} lastPage={data.lastPage} hrefFor={hrefFor} onNavigate={focusHeading} />
      </div>
    </div>
  );
}

ListBody.propTypes = {
  list: PropTypes.object.isRequired,
  emptyTitle: PropTypes.string.isRequired,
  children: PropTypes.node,
};
