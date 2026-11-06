// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STATUS } from '../../Context/authStatus';
import { AuthContext } from '../../Context/useShop';
import RequireAuth from './RequireAuth';

function LoginProbe() {
  const { pathname, search } = useLocation();
  return <p>{`Logowanie ${pathname}${search}`}</p>;
}

function tree(status, retry) {
  return (
    <AuthContext value={{ status, retry }}>
      <MemoryRouter initialEntries={['/orders/5?tab=items']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="orders/:id" element={<p>Szczegóły zamówienia</p>} />
          </Route>
          <Route path="login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext>
  );
}

afterEach(cleanup);

describe('RequireAuth', () => {
  it('shows the page to a signed-in customer', () => {
    render(tree(AUTH_STATUS.authenticated));
    expect(screen.getByText('Szczegóły zamówienia')).toBeTruthy();
  });

  it('waits while the stored token is being checked', () => {
    render(tree(AUTH_STATUS.loading));

    expect(screen.getByRole('status').textContent).toContain('Sprawdzamy logowanie');
    expect(screen.queryByText('Szczegóły zamówienia')).toBeNull();
    expect(screen.queryByText(/^Logowanie/)).toBeNull();
  });

  it('shows the page once the check succeeds, without a detour through login', () => {
    const { rerender } = render(tree(AUTH_STATUS.loading));

    rerender(tree(AUTH_STATUS.authenticated));

    expect(screen.getByText('Szczegóły zamówienia')).toBeTruthy();
  });

  it('sends a guest to login and keeps the path and query', () => {
    render(tree(AUTH_STATUS.guest));
    expect(screen.getByText('Logowanie /login?next=%2Forders%2F5%3Ftab%3Ditems')).toBeTruthy();
  });

  it('offers a retry when the check failed, and does not log the person out', () => {
    const retry = vi.fn();
    render(tree(AUTH_STATUS.unknown, retry));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nie udało się sprawdzić logowania');
    expect(screen.queryByText(/^Logowanie/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
