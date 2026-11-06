import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm } from '../../hooks/useForm';
import { resetPassword } from '../../lib/session';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const MIN_PASSWORD_LENGTH = 8;
const FIELD_IDS = { password: 'reset-password', password_confirmation: 'reset-password-confirmation' };

function clientErrors({ password, password_confirmation: confirmation }) {
  const errors = {};
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
  if (password !== confirmation) errors.password_confirmation = 'Hasła nie są takie same. Wpisz je ponownie';
  return errors;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [values, setValues] = useState({ password: '', password_confirmation: '' });
  const [done, setDone] = useState(null);
  const form = useForm(FIELD_IDS);

  if (!token || !email) {
    return (
      <div className="gutter">
        <EmptyState
          isPage
          title="Ten link jest niepełny"
          text="Otwórz link z wiadomości albo poproś o nowy."
          action={<ButtonLink to="/forgot-password">Poproś o nowy link</ButtonLink>}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="gutter">
        <EmptyState isPage title="Hasło zostało zmienione" text={done} action={<ButtonLink to="/login">Zaloguj się</ButtonLink>} />
      </div>
    );
  }

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
      const { message } = await resetPassword({ token, email, ...values });
      setDone(message);
    });
  };

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-md">
        <PageHeading>Ustaw nowe hasło</PageHeading>
        <p className="mt-3 text-stone">Konto: {email}</p>

        {form.failedSubmits > 0 && form.summary.length > 0 && (
          <div className="mt-6">
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zmienić hasła" />
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field
            id={FIELD_IDS.password}
            label="Nowe hasło"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint={`Co najmniej ${MIN_PASSWORD_LENGTH} znaków.`}
            value={values.password}
            error={form.errors.password}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.password_confirmation}
            label="Powtórz nowe hasło"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={values.password_confirmation}
            error={form.errors.password_confirmation}
            onChange={handleChange}
          />
          <Button type="submit" block loading={form.submitting}>
            Ustaw nowe hasło
          </Button>
        </form>
      </div>
    </div>
  );
}
