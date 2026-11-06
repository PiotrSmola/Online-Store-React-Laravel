// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListBody } from './AdminParts';

const EMPTY = 'Nie ma jeszcze produktów';
const NO_RESULTS = 'Nie znaleźliśmy pasujących wyników';

const setQuery = vi.fn();

function renderList(query, data = { items: [], total: 0, page: 1, lastPage: 1 }, props = {}) {
  const list = { data, error: null, loading: false, reload: vi.fn(), hrefFor: () => '/', query, setQuery };

  render(
    <MemoryRouter>
      <ListBody list={list} emptyTitle={EMPTY} {...props}>
        <p>Wiersze</p>
      </ListBody>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('an empty admin list', () => {
  it('says nothing exists yet when nothing narrows it', () => {
    renderList({});

    expect(screen.getByText(EMPTY)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pokaż wszystkie' })).toBeNull();
  });

  it('says nothing matched when a search is set', () => {
    renderList({ q: 'kurtka' });

    expect(screen.getByText(NO_RESULTS)).toBeTruthy();
    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('does not claim the list is empty on a page past the end', () => {
    renderList({ page: '9' });

    expect(screen.queryByText(EMPTY)).toBeNull();
  });

  it('takes its own title for a filter', () => {
    renderList({ unread: '1' }, undefined, { noResultsTitle: 'Nie ma nieprzeczytanych wiadomości' });

    expect(screen.getByText('Nie ma nieprzeczytanych wiadomości')).toBeTruthy();
  });

  it('clears everything that narrows the list', () => {
    renderList({ q: 'kurtka', status: 'paid' });

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie' }));

    expect(setQuery).toHaveBeenCalledWith({ q: '', status: '' });
  });

  it('shows the rows when there are any', () => {
    renderList({ q: 'kurtka' }, { items: [{ id: 1 }], total: 1, page: 1, lastPage: 1 });

    expect(screen.getByText('Wiersze')).toBeTruthy();
  });
});
