import { useState } from 'react';
import PropTypes from 'prop-types';
import { useSearchParams } from 'react-router';
import { confirmNewsletter, unsubscribeFromNewsletter } from '../../lib/messages';
import Button, { ButtonLink } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeading from '../ui/PageHeading';

const ACTIONS = {
  confirm: {
    title: 'Potwierdź zapis do newslettera',
    text: 'Kliknij przycisk, aby zacząć otrzymywać wiadomości.',
    button: 'Potwierdź zapis',
    run: confirmNewsletter,
  },
  unsubscribe: {
    title: 'Wypisz się z newslettera',
    text: 'Kliknij przycisk, a usuniemy Twój adres z listy.',
    button: 'Wypisz mnie',
    run: unsubscribeFromNewsletter,
  },
};

/**
 * The page behind a newsletter email link. It acts only on a click, because mail scanners open
 * links on their own and must not confirm or remove an address.
 */
function NewsletterAction({ action }) {
  const { title, text, button, run } = ACTIONS[action];
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="gutter">
        <EmptyState
          isPage
          title="Ten link jest niepełny"
          text="Otwórz link z wiadomości e-mail."
          action={<ButtonLink to="/">Wróć do sklepu</ButtonLink>}
        />
      </div>
    );
  }

  if (result) {
    return (
      <div className="gutter">
        <EmptyState isPage title="Gotowe" text={result} action={<ButtonLink to="/">Wróć do sklepu</ButtonLink>} />
      </div>
    );
  }

  const handleClick = async () => {
    if (busy) return;

    setBusy(true);
    setFailure(null);

    try {
      const { message } = await run(token);
      setResult(message);
    } catch (error) {
      setFailure(error.errors?.token?.[0] ?? error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gutter py-8 lg:py-12">
      <div className="max-w-prose">
        <PageHeading>{title}</PageHeading>
        <p className="mt-3 text-stone">{text}</p>
        <Button className="mt-6" loading={busy} onClick={handleClick}>
          {button}
        </Button>
        <p role="alert" className="mt-3 min-h-6 text-ember">
          {failure}
        </p>
      </div>
    </div>
  );
}

NewsletterAction.propTypes = {
  action: PropTypes.oneOf(Object.keys(ACTIONS)).isRequired,
};

export function NewsletterConfirm() {
  return <NewsletterAction action="confirm" />;
}

export function NewsletterUnsubscribe() {
  return <NewsletterAction action="unsubscribe" />;
}
