import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../Context/useShop';
import { useToast } from '../../Context/useToast';
import { useForm } from '../../hooks/useForm';
import { updatePassword, updateProfile } from '../../lib/session';
import Button, { ButtonLink } from '../ui/Button';
import ErrorSummary from '../ui/ErrorSummary';
import Field from '../ui/Field';
import PageHeading from '../ui/PageHeading';
import Radio from '../ui/Radio';

const MIN_PASSWORD_LENGTH = 8;
const ROW = 'grid gap-5 sm:grid-cols-2';

const PROFILE_FIELDS = ['first_name', 'last_name', 'phone', 'company_name', 'nip', 'address', 'postal_code', 'city', 'country'];
const PROFILE_IDS = Object.fromEntries(PROFILE_FIELDS.map((name) => [name, `profile-${name}`]));

const EMPTY_PASSWORDS = { current_password: '', password: '', password_confirmation: '' };
const PASSWORD_IDS = Object.fromEntries(Object.keys(EMPTY_PASSWORDS).map((name) => [name, `account-${name}`]));

function profileValues(customer) {
  const values = Object.fromEntries(PROFILE_FIELDS.map((name) => [name, customer[name] ?? '']));
  return { ...values, customer_type: customer.customer_type ?? 'individual' };
}

function ProfileForm({ customer }) {
  const { updateCustomer } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState(() => profileValues(customer));
  const form = useForm(PROFILE_IDS);
  const isCompany = values.customer_type === 'company';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    form.setFieldError(name, null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = {};
    if (!values.first_name.trim()) found.first_name = 'Wpisz imię';
    if (!values.last_name.trim()) found.last_name = 'Wpisz nazwisko';
    if (isCompany && !values.company_name.trim()) found.company_name = 'Wpisz nazwę firmy';
    if (isCompany && !values.nip.trim()) found.nip = 'Wpisz NIP';

    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();
    form.run(async () => {
      updateCustomer(await updateProfile(values));
      toast.success('Zapisano dane konta');
    });
  };

  const field = (name, label, props) => (
    <Field
      id={PROFILE_IDS[name]}
      name={name}
      label={label}
      value={values[name]}
      error={form.errors[name]}
      onChange={handleChange}
      {...props}
    />
  );

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <h2 className="text-3xl">Dane konta</h2>

      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zapisać danych" />
      )}

      <Field label="E-mail" value={customer.email} readOnly autoComplete="email" hint="Tego adresu nie można zmienić." />

      <fieldset className="border-0 p-0">
        <legend className="font-medium">Typ konta</legend>
        <Radio
          label="Klient indywidualny"
          name="customer_type"
          value="individual"
          checked={!isCompany}
          onChange={handleChange}
        />
        <Radio label="Firma" name="customer_type" value="company" checked={isCompany} onChange={handleChange} />
      </fieldset>

      <div className={ROW}>
        {field('first_name', 'Imię', { required: true, autoComplete: 'given-name', maxLength: 255 })}
        {field('last_name', 'Nazwisko', { required: true, autoComplete: 'family-name', maxLength: 255 })}
      </div>
      {field('phone', 'Telefon (opcjonalnie)', { type: 'tel', autoComplete: 'tel', maxLength: 20 })}
      {isCompany && (
        <div className={ROW}>
          {field('company_name', 'Nazwa firmy', { required: true, autoComplete: 'organization', maxLength: 255 })}
          {field('nip', 'NIP', { required: true, inputMode: 'numeric', maxLength: 20 })}
        </div>
      )}
      {field('address', 'Ulica i numer (opcjonalnie)', { autoComplete: 'street-address', maxLength: 255 })}
      <div className={ROW}>
        {field('postal_code', 'Kod pocztowy (opcjonalnie)', { autoComplete: 'postal-code', maxLength: 10 })}
        {field('city', 'Miasto (opcjonalnie)', { autoComplete: 'address-level2', maxLength: 255 })}
      </div>
      {field('country', 'Kraj (opcjonalnie)', { autoComplete: 'country-name', maxLength: 255 })}

      <Button type="submit" loading={form.submitting}>
        Zapisz dane
      </Button>
    </form>
  );
}

ProfileForm.propTypes = {
  customer: PropTypes.object.isRequired,
};

function PasswordForm() {
  const toast = useToast();
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const form = useForm(PASSWORD_IDS);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    form.setFieldError(name, null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.submitting) return;

    const found = {};
    if (!values.current_password) found.current_password = 'Wpisz obecne hasło';
    if (values.password.length < MIN_PASSWORD_LENGTH) found.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków`;
    if (values.password !== values.password_confirmation) found.password_confirmation = 'Hasła nie są takie same. Wpisz je ponownie';

    if (Object.keys(found).length > 0) {
      form.fail(found);
      return;
    }

    form.reset();
    form.run(async () => {
      await updatePassword(values);
      setValues(EMPTY_PASSWORDS);
      toast.success('Zmieniono hasło. Inne urządzenia zostały wylogowane');
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-md space-y-5">
      <h2 className="text-3xl">Zmień hasło</h2>

      {form.failedSubmits > 0 && form.summary.length > 0 && (
        <ErrorSummary errors={form.summary} focusKey={form.failedSubmits} title="Nie udało się zmienić hasła" />
      )}

      <Field
        id={PASSWORD_IDS.current_password}
        name="current_password"
        label="Obecne hasło"
        type="password"
        autoComplete="current-password"
        required
        value={values.current_password}
        error={form.errors.current_password}
        onChange={handleChange}
      />
      <Field
        id={PASSWORD_IDS.password}
        name="password"
        label="Nowe hasło"
        type="password"
        autoComplete="new-password"
        required
        hint={`Co najmniej ${MIN_PASSWORD_LENGTH} znaków.`}
        value={values.password}
        error={form.errors.password}
        onChange={handleChange}
      />
      <Field
        id={PASSWORD_IDS.password_confirmation}
        name="password_confirmation"
        label="Powtórz nowe hasło"
        type="password"
        autoComplete="new-password"
        required
        value={values.password_confirmation}
        error={form.errors.password_confirmation}
        onChange={handleChange}
      />
      <Button type="submit" loading={form.submitting}>
        Zmień hasło
      </Button>
    </form>
  );
}

export default function Account() {
  const { customer, signOutCustomer } = useAuth();

  return (
    <div className="gutter py-8 lg:py-12">
      <PageHeading>Moje konto</PageHeading>
      <p className="mt-2 text-stone">{`${customer.first_name} ${customer.last_name}`}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink to="/orders">Moje zamówienia</ButtonLink>
        <ButtonLink to="/wishlist" variant="secondary">
          Lista życzeń
        </ButtonLink>
        {customer.is_admin && (
          <ButtonLink to="/admin" variant="secondary">
            Panel administracyjny
          </ButtonLink>
        )}
        <Button variant="secondary" onClick={signOutCustomer}>
          Wyloguj się
        </Button>
      </div>

      <div className="mt-12 grid gap-12 xl:grid-cols-2">
        <ProfileForm customer={customer} />
        <PasswordForm />
      </div>
    </div>
  );
}
