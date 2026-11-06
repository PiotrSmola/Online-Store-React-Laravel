import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { useForm } from '../../hooks/useForm';
import { safeRedirect } from '../../lib/redirect';
import { signIn } from '../../lib/session';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const FIELD_IDS = { email: 'login-email', password: 'login-password' };
const LINK = 'inline-block py-2 text-pine underline underline-offset-4';

function clientErrors({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Wpisz adres e-mail';
  if (!password) errors.password = 'Wpisz hasło';
  return errors;
}

export default function CustomerLogin() {
  const { status, signInWith } = useAuth();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState({ email: '', password: '' });
  const form = useForm(FIELD_IDS);
  const next = safeRedirect(searchParams.get('next'));

  if (status === AUTH_STATUS.authenticated) return <Navigate to={next} replace />;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    form.setFieldError(name, null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = clientErrors(values);
    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();
    form.run(async () => {
      const { customer, token } = await signIn(values);
      signInWith(customer, token);
    });
  };

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-md">
        <PageHeading>Logowanie</PageHeading>

        {form.failedSubmits > 0 && form.summary.length > 0 && (
          <div className="mt-6">
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zalogować" />
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
            value={values.email}
            error={form.errors.email}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.password}
            label="Hasło"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={values.password}
            error={form.errors.password}
            onChange={handleChange}
          />
          <Button type="submit" block loading={form.submitting}>
            Zaloguj się
          </Button>
        </form>

        <ul className="mt-6">
          <li>
            <Link to="/forgot-password" className={LINK}>
              Nie pamiętam hasła
            </Link>
          </li>
          <li>
            <Link to={searchParams.get('next') ? `/register?next=${encodeURIComponent(next)}` : '/register'} className={LINK}>
              Załóż konto
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
