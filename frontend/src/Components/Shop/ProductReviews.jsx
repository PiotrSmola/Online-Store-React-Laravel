import { useState } from 'react';
import PropTypes from 'prop-types';
import { useToast } from '../../Context/useToast';
import { useForm } from '../../hooks/useForm';
import { postReview } from '../../lib/catalog';
import { formatDate } from '../../lib/format';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import Radio from '../ui/Radio';
import Stars from '../ui/Stars';

const RATINGS = [5, 4, 3, 2, 1];
const MAX_COMMENT = 2000;

function ReviewForm({ productId, onSaved }) {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const form = useForm({ comment: 'review-comment' });
  const toast = useToast();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    if (rating === null) {
      form.fail({ rating: 'Wybierz ocenę od 1 do 5' });
      return;
    }

    form.reset();
    form.run(async () => {
      onSaved(await postReview(productId, { rating, comment: comment.trim() || undefined }));
      toast.success('Dziękujemy za opinię');
      setRating(null);
      setComment('');
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-5">
      <h3 className="text-2xl">Dodaj opinię</h3>
      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się dodać opinii" />
      )}
      <fieldset className="border-0 p-0">
        <legend className="font-medium">Twoja ocena</legend>
        {RATINGS.map((value) => (
          <Radio
            key={value}
            label={`${value} na 5`}
            name="rating"
            value={String(value)}
            checked={rating === value}
            onChange={() => setRating(value)}
          />
        ))}
      </fieldset>
      <Field
        id="review-comment"
        multiline
        rows={4}
        label="Komentarz (opcjonalnie)"
        maxLength={MAX_COMMENT}
        value={comment}
        error={form.errors.comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <Button type="submit" loading={form.submitting}>
        Dodaj opinię
      </Button>
    </form>
  );
}

ReviewForm.propTypes = {
  productId: PropTypes.number.isRequired,
  onSaved: PropTypes.func.isRequired,
};

/** Comments are user content, so they stay plain text. A customer's new review replaces the old. */
export default function ProductReviews({ product }) {
  const [reviews, setReviews] = useState(product.reviews ?? []);

  const handleSaved = (review) => {
    setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
  };

  return (
    <section aria-labelledby="product-reviews" className="mt-16 max-w-3xl">
      <h2 id="product-reviews" className="text-2xl lg:text-3xl">
        Opinie
      </h2>

      {reviews.length === 0 && <p className="mt-3 text-stone">Ten produkt nie ma jeszcze opinii.</p>}

      <ul className="mt-4 space-y-6">
        {reviews.map((review) => (
          <li key={review.id}>
            <p className="font-medium">{review.author}</p>
            <div className="flex flex-wrap items-center gap-x-3">
              <Stars rating={review.rating} />
              <span className="text-sm text-stone">{formatDate(review.created_at)}</span>
            </div>
            {review.comment && <p className="mt-1 max-w-prose whitespace-pre-line">{review.comment}</p>}
          </li>
        ))}
      </ul>

      {product.can_review && <ReviewForm productId={product.id} onSaved={handleSaved} />}
    </section>
  );
}

ProductReviews.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    reviews: PropTypes.arrayOf(PropTypes.object),
    can_review: PropTypes.bool,
  }).isRequired,
};
