import { useCallback, useState } from 'react';

function firstMessage(message) {
  return Array.isArray(message) ? message[0] : message;
}

function toFieldErrors(errors) {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([field, message]) => [field, firstMessage(message)]));
}

/**
 * Error and busy state of a form. fieldIds maps a field name to its input id, so a summary entry
 * can link to the field; an error on any other key stays plain text in the summary.
 */
export function useForm(fieldIds = {}) {
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fail = useCallback((fieldErrors, message = null) => {
    setErrors(toFieldErrors(fieldErrors));
    setFormError(message);
    setFailedSubmits((count) => count + 1);
  }, []);

  const failWith = useCallback(
    (error) => {
      const hasFieldErrors = Object.keys(error.errors ?? {}).length > 0;
      fail(error.errors, hasFieldErrors ? null : error.message);
    },
    [fail],
  );

  const setFieldError = useCallback((name, message) => {
    setErrors((current) => ({ ...current, [name]: message ?? undefined }));
  }, []);

  const reset = useCallback(() => {
    setErrors({});
    setFormError(null);
  }, []);

  /** Runs a request, keeps the busy state and shows its failure. A 401 already left the page. */
  const run = useCallback(
    async (action) => {
      setSubmitting(true);
      setFormError(null);

      try {
        await action();
      } catch (error) {
        if (error.status !== 401) failWith(error);
      } finally {
        setSubmitting(false);
      }
    },
    [failWith],
  );

  const summary = [
    ...Object.entries(errors)
      .filter(([, message]) => message)
      .map(([name, message]) => ({ id: fieldIds[name], message })),
    ...(formError ? [{ message: formError }] : []),
  ];

  return { errors, formError, failedSubmits, submitting, summary, fail, failWith, run, reset, setFieldError };
}
