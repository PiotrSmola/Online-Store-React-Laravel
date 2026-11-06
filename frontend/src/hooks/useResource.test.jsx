// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

function deferred() {
  const handle = {};
  handle.promise = new Promise((resolve, reject) => {
    handle.resolve = resolve;
    handle.reject = reject;
  });
  return handle;
}

/** A loader that resolves each call by hand and records the signal it was given. */
function manualLoader() {
  const calls = [];
  const load = vi.fn((signal) => {
    const call = { ...deferred(), signal };
    calls.push(call);
    return call.promise;
  });
  return { load, calls };
}

function render(load, initialKey, options) {
  return renderHook(({ key }) => useResource(load, key, options), { initialProps: { key: initialKey } });
}

async function settle(call, value) {
  await act(async () => {
    call.resolve(value);
    await call.promise;
  });
}

afterEach(cleanup);

describe('useResource', () => {
  it('gives the same object until something changes', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a');
    await settle(calls[0], 'first');

    const first = result.current;
    rerender({ key: 'a' });

    expect(result.current).toBe(first);
  });

  it('loads and reports the data', async () => {
    const { load, calls } = manualLoader();
    const { result } = render(load, 'a');

    expect(result.current).toMatchObject({ loading: true, data: undefined, error: null });

    await settle(calls[0], 'first');

    expect(result.current).toMatchObject({ loading: false, data: 'first', error: null });
  });

  it('does not load for a null key', () => {
    const { load } = manualLoader();
    const { result } = render(load, null);

    expect(load).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('reports a failure', async () => {
    const { load, calls } = manualLoader();
    const { result } = render(load, 'a');
    const failure = new Error('Błąd');

    await act(async () => {
      calls[0].reject(failure);
      await calls[0].promise.catch(() => {});
    });

    expect(result.current).toMatchObject({ loading: false, data: undefined, error: failure });
  });

  it('stays loading when the request is aborted', async () => {
    const { load, calls } = manualLoader();
    const { result } = render(load, 'a');

    await act(async () => {
      calls[0].reject(new DOMException('Aborted', 'AbortError'));
      await calls[0].promise.catch(() => {});
    });

    expect(result.current).toMatchObject({ loading: true, error: null });
  });

  it('aborts the running request when the key changes', () => {
    const { load, calls } = manualLoader();
    const { rerender } = render(load, 'a');

    rerender({ key: 'b' });

    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
  });

  it('aborts the running request on unmount', () => {
    const { load, calls } = manualLoader();
    const { unmount } = render(load, 'a');

    unmount();

    expect(calls[0].signal.aborted).toBe(true);
  });

  it('ignores a stale response that arrives after the newer one', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a');

    rerender({ key: 'b' });
    await settle(calls[1], 'new');
    await settle(calls[0], 'stale');

    expect(result.current.data).toBe('new');
  });

  it('ignores a stale response that arrives before the newer one', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a');

    rerender({ key: 'b' });
    await settle(calls[0], 'stale');

    expect(result.current).toMatchObject({ loading: true, data: undefined });

    await settle(calls[1], 'new');

    expect(result.current).toMatchObject({ loading: false, data: 'new' });
  });

  it('ignores a stale failure', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a');

    rerender({ key: 'b' });
    await settle(calls[1], 'new');
    await act(async () => {
      calls[0].reject(new Error('stale'));
      await calls[0].promise.catch(() => {});
    });

    expect(result.current).toMatchObject({ data: 'new', error: null });
  });

  it('hides the old data while a new key loads', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a');
    await settle(calls[0], 'first');

    rerender({ key: 'b' });

    expect(result.current).toMatchObject({ loading: true, data: undefined });
  });

  it('keeps the old data while a new key loads with keepPrevious', async () => {
    const { load, calls } = manualLoader();
    const { result, rerender } = render(load, 'a', { keepPrevious: true });
    await settle(calls[0], 'first');

    rerender({ key: 'b' });

    expect(result.current).toMatchObject({ loading: true, data: 'first' });
  });

  it('loads again on reload and aborts nothing that finished', async () => {
    const { load, calls } = manualLoader();
    const { result } = render(load, 'a');
    await settle(calls[0], 'first');

    act(() => result.current.reload());
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await settle(calls[1], 'second');

    expect(result.current.data).toBe('second');
  });
});
