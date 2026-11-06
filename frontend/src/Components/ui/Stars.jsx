import PropTypes from 'prop-types';
import { Star } from 'lucide-react';
import { formatRating } from '../../lib/format';

const MAX_RATING = 5;
const POSITIONS = Array.from({ length: MAX_RATING }, (_, index) => index);

export default function Stars({ rating }) {
  const filled = Math.floor(Number(rating));
  const value = formatRating(rating);

  return (
    <p role="img" aria-label={`Ocena ${value} na ${MAX_RATING}`} className="flex items-center gap-2">
      <span className="flex gap-0.5">
        {POSITIONS.map((position) => (
          <Star
            key={position}
            aria-hidden="true"
            className={`size-4 ${position < filled ? 'fill-ink text-ink' : 'text-stone'}`}
          />
        ))}
      </span>
      <span className="text-sm text-stone">{value}</span>
    </p>
  );
}

Stars.propTypes = {
  rating: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
};
