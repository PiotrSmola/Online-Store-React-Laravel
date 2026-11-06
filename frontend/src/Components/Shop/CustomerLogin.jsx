import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { safeRedirect } from '../../lib/redirect';
import { signIn } from '../../lib/session';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const FIELD_IDS = { email: 'login-email', password: 'login-password' };

function clientErrors({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Wpisz adres e-mail';
  if (!password) errors.password = 'Wpisz hasło';
  return errors;
}

export default function CustomerLogin() {
  const { status, signInWith } = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (status === AUTH_STATUS.authenticated) {
    return <Navigate to={safeRedirect(searchParams.get('next'))} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const fail = (fieldErrors, message = null) => {
    setErrors(fieldErrors);
    setFormError(message);
    setFailedSubmits((count) => count + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const found = clientErrors(form);
    if (Object.keys(found).length > 0) {
      fail(found);
      return;
    }

    setSubmitting(true);

    try {
      const { customer, token } = await signIn(form);
      signInWith(customer, token);
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        Object.entries(error.errors ?? {}).map(([field, messages]) => [field, messages[0]]),
      );
      fail(fieldErrors, Object.keys(fieldErrors).length > 0 ? null : error.message);
      setSubmitting(false);
    }
  };

  const summary = [
    ...Object.entries(errors)
      .filter(([, message]) => message)
      .map(([field, message]) => ({ id: FIELD_IDS[field], message })),
    ...(formError ? [{ message: formError }] : []),
  ];

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-md">
        <PageHeading>Logowanie</PageHeading>

        {summary.length > 0 && (
          <div className="mt-6">
            <ErrorSummary errors={summary} focusKey={failedSubmits} title="Nie udało się zalogować" />
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field
            id={FIELD_IDS.email}
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            error={errors.email}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.password}
            label="Hasło"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            error={errors.password}
            onChange={handleChange}
          />
          <Button type="submit" block loading={submitting}>
            Zaloguj się
          </Button>
        </form>

        <p className="mt-6 text-stone">Nie masz konta? Założymy je przy pierwszym zamówieniu.</p>
        <Link to="/products" className="mt-2 inline-block py-2 text-pine underline underline-offset-4">
          Zobacz produkty
        </Link>
      </div>
    </div>
  );
}
