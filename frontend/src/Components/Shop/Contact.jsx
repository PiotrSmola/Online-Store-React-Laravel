import { useState } from 'react';
import { useShopData } from '../../Context/useShopData';
import { useForm } from '../../hooks/useForm';
import { sendContactMessage } from '../../lib/messages';
import Button from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';

const EMPTY = { name: '', email: '', subject: '', message: '', website: '' };
const FIELD_IDS = { name: 'contact-name', email: 'contact-email', subject: 'contact-subject', message: 'contact-message' };

function clientErrors(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Wpisz imię i nazwisko';
  if (!values.email.trim()) errors.email = 'Wpisz adres e-mail';
  if (!values.subject.trim()) errors.subject = 'Wpisz temat';
  if (!values.message.trim()) errors.message = 'Wpisz wiadomość';
  return errors;
}

export default function Contact() {
  const { config } = useShopData();
  const contact = config.data?.contact;
  const [values, setValues] = useState(EMPTY);
  const [confirmation, setConfirmation] = useState(null);
  const form = useForm(FIELD_IDS);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    form.setFieldError(name, null);
    setConfirmation(null);
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
      const { message } = await sendContactMessage(values);
      setConfirmation(message);
      setValues(EMPTY);
    });
  };

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Kontakt</PageHeading>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <form noValidate onSubmit={handleSubmit} className="max-w-xl space-y-5">
          {form.failedSubmits > 0 && form.summary.length > 0 && (
            <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się wysłać wiadomości" />
          )}

          <Field
            id={FIELD_IDS.name}
            name="name"
            label="Imię i nazwisko"
            autoComplete="name"
            required
            maxLength={100}
            value={values.name}
            error={form.errors.name}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.email}
            name="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            error={form.errors.email}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.subject}
            name="subject"
            label="Temat"
            required
            maxLength={150}
            value={values.subject}
            error={form.errors.subject}
            onChange={handleChange}
          />
          <Field
            id={FIELD_IDS.message}
            name="message"
            label="Wiadomość"
            multiline
            rows={6}
            required
            maxLength={5000}
            value={values.message}
            error={form.errors.message}
            onChange={handleChange}
          />

          {/* A trap for bots: people and screen readers never reach it, and a filled one is ignored. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="contact-website">Strona internetowa</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={handleChange}
            />
          </div>

          <Button type="submit" loading={form.submitting}>
            Wyślij wiadomość
          </Button>
          <p role="status" className="min-h-6 text-pine">
            {confirmation}
          </p>
        </form>

        {contact && (
          <section aria-labelledby="contact-details">
            <h2 id="contact-details" className="text-2xl">
              Dane kontaktowe
            </h2>
            <address className="mt-2 not-italic">
              <p>{contact.address}</p>
              <p>
                <a href={`mailto:${contact.email}`} className="text-pine underline underline-offset-4">
                  {contact.email}
                </a>
              </p>
              <p>{contact.phone}</p>
              <p className="text-stone">{contact.opening_hours}</p>
            </address>
          </section>
        )}
      </div>
    </div>
  );
}
