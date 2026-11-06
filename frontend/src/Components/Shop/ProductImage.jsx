import { useState } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_IMAGE_URL, THUMBNAIL_WIDTH, imageUrl } from '../../lib/product';

// Originals vary in size. This only tells the browser to use one when 640 px is not enough.
const ORIGINAL_WIDTH = 1600;
const LIST_SIZES = '(min-width: 96rem) 20vw, (min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw';

function sourcesFor(image, thumbnail) {
  const sources = [imageUrl(image, { thumbnail }), imageUrl(image), DEFAULT_IMAGE_URL];
  return [...new Set(sources)];
}

function responsiveSources(image) {
  const thumbnail = imageUrl(image, { thumbnail: true });
  return `${thumbnail} ${THUMBNAIL_WIDTH}w, ${imageUrl(image)} ${ORIGINAL_WIDTH}w`;
}

/**
 * A 3:4 product photo. A missing thumbnail falls back to the original, and a missing original to
 * the default photo. Give it a key when the same element can show another photo.
 *
 * @param {'lazy' | 'eager' | 'high'} priority eager for the first row, high for the likely LCP image.
 * @param {string} sizes Rendered width, for the browser's choice between thumbnail and original.
 */
export default function ProductImage({
  image = null,
  alt,
  thumbnail = false,
  priority = 'lazy',
  sizes = LIST_SIZES,
  className = '',
}) {
  const [failures, setFailures] = useState(0);
  const sources = sourcesFor(image, thumbnail);
  const useSrcSet = failures === 0 && Boolean(image?.image_path);

  return (
    <img
      src={sources[Math.min(failures, sources.length - 1)]}
      srcSet={useSrcSet ? responsiveSources(image) : undefined}
      sizes={useSrcSet ? sizes : undefined}
      alt={alt}
      width="600"
      height="800"
      decoding="async"
      loading={priority === 'lazy' ? 'lazy' : 'eager'}
      fetchPriority={priority === 'high' ? 'high' : undefined}
      className={`aspect-[3/4] w-full bg-mist object-cover ${className}`}
      onError={() => setFailures((count) => (count < sources.length - 1 ? count + 1 : count))}
    />
  );
}

ProductImage.propTypes = {
  image: PropTypes.shape({ image_path: PropTypes.string }),
  alt: PropTypes.string.isRequired,
  thumbnail: PropTypes.bool,
  priority: PropTypes.oneOf(['lazy', 'eager', 'high']),
  sizes: PropTypes.string,
  className: PropTypes.string,
};
