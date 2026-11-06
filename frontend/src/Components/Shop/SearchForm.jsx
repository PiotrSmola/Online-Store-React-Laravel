import { startTransition, useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { nextCatalogSearch, readCatalogQuery } from '../../lib/catalogQuery';

const CATALOG_PATH = '/products';
const DEBOUNCE_MS = 350;

/**
 * Enter opens the results from any page. On the catalog itself results also follow typing, which
 * stays on the same route, so focus stays in this field.
 */
export default function SearchForm({ className = '' }) {
  const id = useId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onCatalog = pathname === CATALOG_PATH;
  const urlQuery = onCatalog ? (searchParams.get('q') ?? '') : '';

  const [text, setText] = useState(urlQuery);
  const [knownQuery, setKnownQuery] = useState(urlQuery);

  // The URL can change without typing: the back button, a link, a cleared filter.
  if (knownQuery !== urlQuery) {
    setKnownQuery(urlQuery);
    setText(urlQuery);
  }

  const search = (q) => {
    const query = onCatalog ? readCatalogQuery(searchParams) : {};
    const params = nextCatalogSearch(query, { q }).toString();
    startTransition(() => navigate(params ? `${CATALOG_PATH}?${params}` : CATALOG_PATH, { replace: onCatalog }));
  };

  useEffect(() => {
    const q = text.trim();
    if (!onCatalog || q === urlQuery) return undefined;

    const timer = setTimeout(() => {
      setKnownQuery(q);
      const params = nextCatalogSearch(readCatalogQuery(searchParams), { q }).toString();
      startTransition(() => navigate(params ? `${CATALOG_PATH}?${params}` : CATALOG_PATH, { replace: true }));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, onCatalog, urlQuery, searchParams, navigate]);

  return (
    <form
      role="search"
      className={`flex items-center ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        search(text.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        Szukaj produktów
      </label>
      <input
        id={id}
        type="search"
        maxLength={100}
        placeholder="Szukaj produktów"
        autoComplete="off"
        className="h-11 min-w-0 grow rounded-l-control border border-r-0 border-stone bg-white px-3 text-ink placeholder:text-stone"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="submit"
        aria-label="Szukaj"
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-r-control bg-pine text-white hover:bg-ink"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}

SearchForm.propTypes = {
  className: PropTypes.string,
};
