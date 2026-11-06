import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { AUTH_STATUS } from '../../Context/authStatus';
import { useAuth } from '../../Context/useShop';
import { useForm } from '../../hooks/useForm';
import { loginPath, safeRedirect } from '../../lib/redirect';
import { register } from '../../lib/session';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const MIN_PASSWORD_LENGTH = 8;
const EMPTY = { first_name: '', last_name: '', email: '', password: '', password_confirmation: '' };
const FIELD_IDS = Object.fromEntries(Object.keys(EMPTY).map((name) => [name, `register-${name}`]));

function clientErrors(values) {
  const errors = {};
  if (!values.first_name.trim()) errors.first_name = 'Wpisz imię';
  if (!values.last_name.trim()) errors.last_name = 'Wpisz nazwisko';
  if (!values.email.trim()) errors.email = 'Wpisz adres e-mail';
  if (values.password.length < MIN_PASSWORD_LENGTH) errors.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
  if (values.password !== values.password_confirmation) errors.password_confirmation = 'Hasła nie są takie same. Wpisz je ponownie';
  return errors;
}

export default function Register() {
  const { status, signInWith } = useAuth();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState(EMPTY);
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
      const { customer, token } = await register(values);
      signInWith(customer, token);
    });
  };

  const field = (name, label, props) => (
    <Field
      id={FIELD_IDS[name]}
      name={name}
      label={label}
      required
      value={values[name]}
      error={form.errors[name]}
      onChange={handleChange}
      {...props}
    />
  );

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-md">
        <PageHeading>Załóż konto</PageHeading>

        {form.failedSubmits > 0 && form.summary.length > 0 && (
          <div className="mt-6">
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się założyć konta" />
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          {field('first_name', 'Imię', { autoComplete: 'given-name', maxLength: 255 })}
          {field('last_name', 'Nazwisko', { autoComplete: 'family-name', maxLength: 255 })}
          {field('email', 'E-mail', { type: 'email', autoComplete: 'email' })}
          {field('password', 'Hasło', {
            type: 'password',
            autoComplete: 'new-password',
            hint: `Co najmniej ${MIN_PASSWORD_LENGTH} znaków.`,
          })}
          {field('password_confirmation', 'Powtórz hasło', { type: 'password', autoComplete: 'new-password' })}
          <Button type="submit" block loading={form.submitting}>
            Załóż konto
          </Button>
        </form>

        <Link to={loginPath(next)} className="mt-6 inline-block py-2 text-pine underline underline-offset-4">
          Mam już konto
        </Link>
      </div>
    </div>
  );
}
