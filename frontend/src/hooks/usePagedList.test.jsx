// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePagedList } from './usePagedList';

function setup(url, page) {
  const fetchPage = vi.fn(async () => page);
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  const { result } = renderHook(() => usePagedList(fetchPage), { wrapper });

  return { fetchPage, result };
}

const lastQuery = (fetchPage) => fetchPage.mock.lastCall[0];

afterEach(cleanup);

describe('afterRemoval', () => {
  it('steps back when the last row of a later page goes, keeping the search', async () => {
    const { fetchPage, result } = setup('/admin?q=a&page=3', { items: [{ id: 1 }], page: 3, lastPage: 3, total: 49 });
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.afterRemoval());

    await waitFor(() => expect(lastQuery(fetchPage)).toEqual({ q: 'a', page: '2' }));
  });

  it('drops the page from the URL when stepping back to the first page', async () => {
    const { fetchPage, result } = setup('/admin?page=2', { items: [{ id: 1 }], page: 2, lastPage: 2, total: 25 });
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.afterRemoval());

    await waitFor(() => expect(lastQuery(fetchPage)).toEqual({}));
  });

  it('only reloads when rows remain on the page', async () => {
    const { fetchPage, result } = setup('/admin?page=2', { items: [{ id: 1 }, { id: 2 }], page: 2, lastPage: 2, total: 26 });
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.afterRemoval());

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(lastQuery(fetchPage)).toEqual({ page: '2' });
  });

  it('only reloads on the first page', async () => {
    const { fetchPage, result } = setup('/admin', { items: [{ id: 1 }], page: 1, lastPage: 1, total: 1 });
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.afterRemoval());

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(lastQuery(fetchPage)).toEqual({});
  });
});
