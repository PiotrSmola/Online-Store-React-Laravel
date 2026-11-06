// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorSummary from './ErrorSummary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorSummary', () => {
  it('is a group named by its heading', () => {
    render(<ErrorSummary errors={[{ message: 'Błąd' }]} focusKey={1} title="Popraw dane" />);
    expect(screen.getByRole('group', { name: 'Popraw dane' })).toBeTruthy();
  });

  it('takes focus when it appears and on each failed submit', () => {
    const errors = [{ message: 'Błąd' }];
    const { rerender } = render(<ErrorSummary errors={errors} focusKey={1} />);
    const group = screen.getByRole('group');
    expect(document.activeElement).toBe(group);

    group.blur();
    rerender(<ErrorSummary errors={errors} focusKey={2} />);

    expect(document.activeElement).toBe(group);
  });

  it('renders two entries with the same message and no field', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ErrorSummary errors={[{ message: 'Wybierz rozmiar' }, { message: 'Wybierz rozmiar' }]} focusKey={1} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('links an entry to its field', () => {
    render(<ErrorSummary errors={[{ id: 'email', message: 'Wpisz e-mail' }]} focusKey={1} />);
    expect(screen.getByRole('link', { name: 'Wpisz e-mail' }).getAttribute('href')).toBe('#email');
  });
});
