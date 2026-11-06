// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadProductImage } from '../../lib/admin';
import ProductImages from './ProductImages';

vi.mock('../../lib/admin', () => ({ uploadProductImage: vi.fn(), deleteProductImage: vi.fn() }));
vi.mock('../../Context/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const photo = new File(['x'], 'zdjecie.png', { type: 'image/png' });
const text = new File(['x'], 'notatka.txt', { type: 'text/plain' });

const fileInput = () => screen.getByLabelText('Dodaj zdjęcie');
const choose = (file) => fireEvent.change(fileInput(), { target: { files: [file] } });

function trackReset(input) {
  return vi.spyOn(input, 'value', 'set');
}

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() }));
  uploadProductImage.mockResolvedValue({ id: 2, image_path: 'nowe.jpg' });
  render(<ProductImages productId={1} initialImages={[]} name="Kurtka" />);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the photo input', () => {
  it('stays the same element when a file is chosen', () => {
    const input = fileInput();

    input.focus();
    choose(photo);

    expect(fileInput()).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('is emptied by ref after an upload, and takes focus from the button that goes away', async () => {
    const input = fileInput();
    const reset = trackReset(input);

    choose(photo);
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zdjęcie' }));
    await screen.findByAltText('Zdjęcie 1: Kurtka');

    expect(reset).toHaveBeenCalledWith('');
    expect(fileInput()).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Wyślij zdjęcie' })).toBeNull();
  });

  it('forgets a refused file, so choosing it again fires a change', () => {
    const reset = trackReset(fileInput());

    choose(text);

    expect(screen.getByRole('alert').textContent).toBe('Wybierz plik JPG, PNG albo WEBP');
    expect(reset).toHaveBeenCalledWith('');
  });

  it('keeps the chosen file when the upload fails', async () => {
    uploadProductImage.mockRejectedValue(Object.assign(new Error('Serwer nie odpowiada'), { status: 500 }));
    const reset = trackReset(fileInput());

    choose(photo);
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij zdjęcie' }));
    await screen.findByText('Serwer nie odpowiada');

    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wyślij zdjęcie' })).toBeTruthy();
  });
});
