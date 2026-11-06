// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogFilters from './CatalogFilters';

const query = { q: '', sort: '', min_price: '', max_price: '', size: '', color: '', page: 1 };
const ERROR = 'Wpisz cenę, na przykład 49.99';
const AFTER_TYPING = 1000;

const onChange = vi.fn();

const field = () => screen.getByLabelText('Cena od');
const type = (value) => fireEvent.change(field(), { target: { value } });
const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  render(<CatalogFilters query={query} onChange={onChange} />);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the price field', () => {
  it.each(['.', '1.5.5', '1.', '1.555'])('does not apply %s, and says why', (value) => {
    type(value);
    wait(AFTER_TYPING);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(ERROR)).toBeTruthy();
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });

  it.each(['49', '49.9', '49.99'])('applies %s', (value) => {
    type(value);
    wait(AFTER_TYPING);

    expect(onChange).toHaveBeenCalledWith({ min_price: value });
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it('accepts a comma as the decimal mark', () => {
    type('49,99');
    wait(AFTER_TYPING);

    expect(onChange).toHaveBeenCalledWith({ min_price: '49.99' });
  });

  it('does not scold a value that is still being typed', () => {
    type('49.');
    wait(100);

    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it('drops the error once the value is fixed', () => {
    type('1.5.5');
    wait(AFTER_TYPING);

    type('1.5');
    wait(AFTER_TYPING);

    expect(screen.queryByText(ERROR)).toBeNull();
    expect(onChange).toHaveBeenCalledWith({ min_price: '1.5' });
  });
});
