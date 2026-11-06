// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_QUANTITY } from '../../lib/cart';
import QuantityStepper from './QuantityStepper';

const decrease = () => screen.getByRole('button', { name: /Zmniejsz/ });
const increase = () => screen.getByRole('button', { name: /Zwiększ/ });

afterEach(cleanup);

describe('QuantityStepper', () => {
  it('steps up and down', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);

    fireEvent.click(increase());
    expect(onChange).toHaveBeenLastCalledWith(6);

    fireEvent.click(decrease());
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('keeps focus on the decrease button at the minimum', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} onChange={onChange} />);

    decrease().focus();
    fireEvent.click(decrease());

    expect(onChange).not.toHaveBeenCalled();
    expect(decrease().getAttribute('aria-disabled')).toBe('true');
    expect(decrease().disabled).toBe(false);
    expect(document.activeElement).toBe(decrease());
  });

  it('keeps focus on the increase button at the maximum', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={MAX_QUANTITY} onChange={onChange} />);

    increase().focus();
    fireEvent.click(increase());

    expect(onChange).not.toHaveBeenCalled();
    expect(increase().getAttribute('aria-disabled')).toBe('true');
    expect(increase().disabled).toBe(false);
    expect(document.activeElement).toBe(increase());
  });

  it('stops at the stock when it is known', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={3} max={3} onChange={onChange} />);

    fireEvent.click(increase());
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('marks neither button in the middle of the range', () => {
    render(<QuantityStepper value={5} onChange={vi.fn()} />);

    expect(decrease().getAttribute('aria-disabled')).toBeNull();
    expect(increase().getAttribute('aria-disabled')).toBeNull();
  });

  it('lets the person clear the field while typing', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('names the product in its labels', () => {
    render(<QuantityStepper value={5} onChange={vi.fn()} target="Kurtka" />);
    expect(screen.getByRole('button', { name: 'Zwiększ ilość: Kurtka' })).toBeTruthy();
  });
});
