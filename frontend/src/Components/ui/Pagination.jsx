import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

const ITEM = 'grid size-11 place-items-center rounded-control';
const LINK = `${ITEM} text-pine hover:bg-mist`;

function visiblePages(page, lastPage) {
  const pages = [1, page - 1, page, page + 1, lastPage].filter((number) => number >= 1 && number <= lastPage);
  return [...new Set(pages)];
}

/** hrefFor(page) gives the URL of a page, so the page number lives in the query string. */
export default function Pagination({ page, lastPage, hrefFor }) {
  if (lastPage <= 1) return null;

  return (
    <nav aria-label="Strony">
      <ul className="flex flex-wrap items-center gap-1">
        {page > 1 && (
          <li>
            <Link to={hrefFor(page - 1)} aria-label="Poprzednia strona" className={LINK}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
          </li>
        )}
        {visiblePages(page, lastPage).map((number, index, pages) => (
          <li key={number} className="flex items-center gap-1">
            {index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">...</span>}
            {number === page ? (
              <span aria-current="page" className={`${ITEM} bg-pine font-semibold text-white`}>
                {number}
              </span>
            ) : (
              <Link to={hrefFor(number)} aria-label={`Strona ${number}`} className={LINK}>
                {number}
              </Link>
            )}
          </li>
        ))}
        {page < lastPage && (
          <li>
            <Link to={hrefFor(page + 1)} aria-label="Następna strona" className={LINK}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  lastPage: PropTypes.number.isRequired,
  hrefFor: PropTypes.func.isRequired,
};
