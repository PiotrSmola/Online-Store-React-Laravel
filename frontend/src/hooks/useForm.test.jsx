// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import { useForm } from './useForm';

const ids = { email: 'login-email' };

afterEach(cleanup);

describe('useForm', () => {
  it('starts with nothing to report', () => {
    const { result } = renderHook(() => useForm(ids));
    expect(result.current).toMatchObject({ errors: {}, summary: [], failedSubmits: 0, submitting: false });
  });

  it('links a field error in the summary and counts the failure', () => {
    const { result } = renderHook(() => useForm(ids));

    act(() => result.current.fail({ email: 'Wpisz adres e-mail' }));

    expect(result.current.summary).toEqual([{ id: 'login-email', message: 'Wpisz adres e-mail' }]);
    expect(result.current.failedSubmits).toBe(1);
  });

  it('keeps an error on an unknown field as plain text', () => {
    const { result } = renderHook(() => useForm(ids));

    act(() => result.current.fail({ 'cart_items.0.selected_size': ['Wybierz rozmiar'] }));

    expect(result.current.summary).toEqual([{ id: undefined, message: 'Wybierz rozmiar' }]);
  });

  it('shows the first message of an API error list', () => {
    const { result } = renderHook(() => useForm(ids));

    act(() => result.current.failWith(new ApiError('Błędy', { errors: { email: ['Pierwszy', 'Drugi'] }, status: 422 })));

    expect(result.current.errors.email).toBe('Pierwszy');
    expect(result.current.formError).toBeNull();
  });

  it('shows the message when an error names no field', () => {
    const { result } = renderHook(() => useForm(ids));

    act(() => result.current.failWith(new ApiError('Zamówienie jest już opłacone.', { status: 409 })));

    expect(result.current.summary).toEqual([{ message: 'Zamówienie jest już opłacone.' }]);
  });

  it('clears one field as it is corrected', () => {
    const { result } = renderHook(() => useForm(ids));

    act(() => result.current.fail({ email: 'Wpisz adres e-mail' }));
    act(() => result.current.setFieldError('email', null));

    expect(result.current.summary).toEqual([]);
  });

  it('reports a failed action and ends the busy state', async () => {
    const { result } = renderHook(() => useForm(ids));

    await act(() => result.current.run(async () => {
      throw new ApiError('Zbyt wiele prób.', { status: 429 });
    }));

    expect(result.current.formError).toBe('Zbyt wiele prób.');
    expect(result.current.submitting).toBe(false);
  });

  it('stays quiet about a 401, which has already left the page', async () => {
    const { result } = renderHook(() => useForm(ids));

    await act(() => result.current.run(async () => {
      throw new ApiError('Nie zalogowano', { status: 401 });
    }));

    expect(result.current.failedSubmits).toBe(0);
  });

  it('is busy while the action runs', async () => {
    const { result } = renderHook(() => useForm(ids));
    let finish;

    let running;
    act(() => {
      running = result.current.run(() => new Promise((resolve) => { finish = resolve; }));
    });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      finish();
      await running;
    });
    expect(result.current.submitting).toBe(false);
  });
});
