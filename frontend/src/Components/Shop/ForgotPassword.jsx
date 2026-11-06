import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from '../../hooks/useForm';
import { forgotPassword } from '../../lib/session';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const FIELD_IDS = { email: 'forgot-email' };

/** The reply is the same for every address, so the page never reveals who has an account. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const form = useForm(FIELD_IDS);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    if (!email.trim()) {
      form.fail({ email: 'Wpisz adres e-mail' });
      return;
    }

    form.reset();
    form.run(async () => {
      const { message } = await forgotPassword(email.trim());
      setConfirmation(message);
    });
  };

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-md">
        <PageHeading>Nie pamiętam hasła</PageHeading>
        <p className="mt-3 text-stone">Wpisz adres konta, a wyślemy link do ustawienia nowego hasła.</p>

        {form.failedSubmits > 0 && form.summary.length > 0 && (
          <div className="mt-6">
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się wysłać linku" />
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field
            id={FIELD_IDS.email}
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            error={form.errors.email}
            onChange={(event) => {
              setEmail(event.target.value);
              form.setFieldError('email', null);
            }}
          />
          <Button type="submit" block loading={form.submitting}>
            Wyślij link
          </Button>
        </form>

        <p role="status" className="mt-4 min-h-6 text-pine">
          {confirmation}
        </p>

        <Link to="/login" className="mt-2 inline-block py-2 text-pine underline underline-offset-4">
          Wróć do logowania
        </Link>
      </div>
    </div>
  );
}
