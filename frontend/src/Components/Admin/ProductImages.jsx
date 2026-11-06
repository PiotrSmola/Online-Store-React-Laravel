import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useToast } from '../../Context/useToast';
import { deleteProductImage, uploadProductImage } from '../../lib/admin';
import { imageUrl } from '../../lib/product';
import Button from '../ui/Button';
import { ERROR, HINT, LABEL } from '../ui/controlClasses';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp';

function fileError(file) {
  if (!ACCEPTED.split(',').includes(file.type)) return 'Wybierz plik JPG, PNG albo WEBP';
  return file.size > MAX_SIZE ? 'Plik jest za duży. Wybierz zdjęcie do 5 MB' : null;
}

/** Photos of a saved product. The server checks the real content of an upload. */
export default function ProductImages({ productId, initialImages, name }) {
  const inputId = useId();
  const input = useRef(null);
  const [images, setImages] = useState(initialImages);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Runs when the preview changes and when the component leaves, so no object URL outlives its use.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const handleFile = (event) => {
    const chosen = event.target.files[0] ?? null;
    const problem = chosen ? fileError(chosen) : null;
    const accepted = chosen && !problem;

    setError(problem);
    setFile(accepted ? chosen : null);
    setPreview(accepted ? URL.createObjectURL(chosen) : null);
    if (problem) event.target.value = '';
  };

  const handleUpload = async () => {
    setBusy(true);
    setError(null);

    try {
      const image = await uploadProductImage(productId, file);
      setImages((current) => [...current, image]);
      setFile(null);
      setPreview(null);
      input.current.value = '';
      input.current.focus();
      toast.success('Dodano zdjęcie');
    } catch (requestError) {
      if (requestError.status !== 401) setError(requestError.errors?.image?.[0] ?? requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (image) => {
    try {
      await deleteProductImage(productId, image.id);
      setImages((current) => current.filter((item) => item.id !== image.id));
      toast.success('Usunięto zdjęcie');
    } catch (requestError) {
      if (requestError.status !== 401) toast.error(requestError.message);
    }
  };

  return (
    <section aria-labelledby="product-images" className="mt-12">
      <h2 id="product-images" className="mb-4 text-2xl">
        Zdjęcia
      </h2>

      {images.length === 0 && <p className="text-stone">Ten produkt nie ma jeszcze zdjęć.</p>}

      <ul className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.id}>
            <img
              src={imageUrl(image, { thumbnail: true })}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = imageUrl(image);
              }}
              alt={`Zdjęcie ${index + 1}: ${name}`}
              width="150"
              height="200"
              loading="lazy"
              className="aspect-[3/4] w-full bg-mist object-cover"
            />
            <Button variant="plain" aria-label={`Usuń zdjęcie ${index + 1}`} onClick={() => handleRemove(image)}>
              Usuń
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-6 max-w-md">
        <label htmlFor={inputId} className={LABEL}>
          Dodaj zdjęcie
        </label>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPTED}
          aria-describedby={`${inputId}-hint`}
          className="mt-1 block w-full cursor-pointer text-ink file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-control file:border file:border-pine file:bg-white file:px-4 file:font-semibold file:text-pine hover:file:bg-mist"
          onChange={handleFile}
        />
        <p id={`${inputId}-hint`} className={HINT}>
          JPG, PNG albo WEBP, do 5 MB.
        </p>
        {preview && <img src={preview} alt="Podgląd wybranego zdjęcia" width="150" height="200" className="mt-3 aspect-[3/4] w-36 bg-mist object-cover" />}
        {error && (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        )}
        {file && (
          <Button variant="secondary" className="mt-3" loading={busy} onClick={handleUpload}>
            Wyślij zdjęcie
          </Button>
        )}
      </div>
    </section>
  );
}

ProductImages.propTypes = {
  productId: PropTypes.number.isRequired,
  initialImages: PropTypes.arrayOf(PropTypes.object).isRequired,
  name: PropTypes.string.isRequired,
};
