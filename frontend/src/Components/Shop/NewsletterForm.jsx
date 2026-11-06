import { useState } from 'react';
import { subscribeToNewsletter } from '../../lib/messages';
import { useForm } from '../../hooks/useForm';
import Button from '../ui/Button';
import Field from '../ui/Field';

/** Double opt-in: the reply is the same for every address, so it never reveals who subscribes. */
export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const form = useForm();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    if (!email.trim()) {
      form.fail({ email: 'Wpisz adres e-mail' });
      return;
    }

    form.reset();
    form.run(async () => {
      const { message } = await subscribeToNewsletter(email.trim());
      setConfirmation(message);
      setEmail('');
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-sm">
      <Field
        label="Twój e-mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        error={form.errors.email ?? form.formError}
        hint="Wyślemy jedną wiadomość z prośbą o potwierdzenie. Możesz wypisać się w każdej chwili."
        onChange={(event) => {
          setEmail(event.target.value);
          setConfirmation(null);
        }}
      />
      <Button type="submit" variant="secondary" loading={form.submitting} className="mt-3">
        Zapisz się
      </Button>
      <p role="status" className="mt-2 min-h-6 max-w-prose text-pine">
        {confirmation}
      </p>
    </form>
  );
}
