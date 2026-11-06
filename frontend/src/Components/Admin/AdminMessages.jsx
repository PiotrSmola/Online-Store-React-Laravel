import { useState } from 'react';
import { useToast } from '../../Context/useToast';
import { useFocusPageHeading } from '../../hooks/useFocusPageHeading';
import { usePagedList } from '../../hooks/usePagedList';
import { deleteMessage, getMessages, markMessageRead } from '../../lib/admin';
import { formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import PageHeading from '../ui/PageHeading';
import { ListBody } from './AdminParts';

/** Everything here comes from the contact form, so it is only ever rendered as plain text. */
export default function AdminMessages() {
  const list = usePagedList(getMessages);
  const [deleting, setDeleting] = useState(null);
  const toast = useToast();
  const focusHeading = useFocusPageHeading();
  const unreadOnly = list.query.unread === '1';

  const handleRead = async (message) => {
    try {
      await markMessageRead(message.id);
      toast.success('Oznaczono jako przeczytane');
      list.reload();
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    const message = deleting;
    setDeleting(null);

    try {
      const result = await deleteMessage(message.id);
      toast.success(result.message);
      list.reload();
      focusHeading();
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
  };

  return (
    <>
      <PageHeading>Wiadomości</PageHeading>

      <label className="my-4 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-pine"
          checked={unreadOnly}
          onChange={(event) => list.setQuery({ unread: event.target.checked ? '1' : '' })}
        />
        Tylko nieprzeczytane
      </label>

      <ListBody
        list={list}
        emptyTitle="Nie ma jeszcze wiadomości"
        noResultsTitle={unreadOnly ? 'Nie ma nieprzeczytanych wiadomości' : undefined}
      >
        <ul className="max-w-3xl space-y-8">
          {list.data?.items.map((message) => (
            <li key={message.id}>
              <h2 className="text-2xl">{message.subject}</h2>
              <p className="text-stone">
                {message.name}, {message.email}
              </p>
              <p className="text-sm text-stone">{formatDateTime(message.created_at)}</p>
              <p className={`text-sm font-semibold ${message.read_at ? 'text-stone' : 'text-pine'}`}>
                {message.read_at ? 'Przeczytana' : 'Nowa'}
              </p>
              <p className="mt-2 max-w-prose whitespace-pre-line">{message.message}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {!message.read_at && (
                  <Button variant="plain" aria-label={`Oznacz jako przeczytaną: ${message.subject}`} onClick={() => handleRead(message)}>
                    Oznacz jako przeczytaną
                  </Button>
                )}
                <Button variant="plain" aria-label={`Usuń wiadomość: ${message.subject}`} onClick={() => setDeleting(message)}>
                  Usuń
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </ListBody>

      <ConfirmDialog
        open={deleting !== null}
        title="Usunąć wiadomość?"
        text={deleting?.subject ?? ''}
        confirmLabel="Usuń wiadomość"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
