// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_URL } from '../../lib/product';
import ProductImage from './ProductImage';

const image = { image_path: 'zdj1.jpg' };

const shown = () => screen.getByRole('img', { hidden: true }).getAttribute('src');
const failLoading = () => fireEvent.error(screen.getByRole('img', { hidden: true }));

afterEach(cleanup);

describe('ProductImage', () => {
  it('walks from the thumbnail to the original to the default photo', () => {
    render(<ProductImage image={image} alt="Kurtka" thumbnail />);
    expect(shown()).toMatch(/\/storage\/products\/thumbs\/zdj1\.jpg$/);

    failLoading();
    expect(shown()).toMatch(/\/storage\/products\/zdj1\.jpg$/);

    failLoading();
    expect(shown()).toBe(DEFAULT_IMAGE_URL);
  });

  it('stops at the default photo instead of looping', () => {
    render(<ProductImage image={image} alt="Kurtka" thumbnail />);

    failLoading();
    failLoading();
    failLoading();
    failLoading();

    expect(shown()).toBe(DEFAULT_IMAGE_URL);
  });

  it('starts from the original when no thumbnail is wanted', () => {
    render(<ProductImage image={image} alt="Kurtka" />);
    expect(shown()).toMatch(/\/storage\/products\/zdj1\.jpg$/);

    failLoading();
    expect(shown()).toBe(DEFAULT_IMAGE_URL);
  });

  it('uses the default photo for a product without images', () => {
    render(<ProductImage alt="Kurtka" thumbnail />);
    expect(shown()).toBe(DEFAULT_IMAGE_URL);
  });

  it('offers the thumbnail and the original through srcset', () => {
    render(<ProductImage image={image} alt="Kurtka" thumbnail />);

    const srcset = screen.getByRole('img', { hidden: true }).getAttribute('srcset');
    expect(srcset).toMatch(/thumbs\/zdj1\.jpg 640w/);
    expect(srcset).toMatch(/products\/zdj1\.jpg 1600w/);
  });

  it('drops srcset after a failure, so the browser cannot pick the missing thumbnail again', () => {
    render(<ProductImage image={image} alt="Kurtka" thumbnail />);

    failLoading();

    expect(screen.getByRole('img', { hidden: true }).getAttribute('srcset')).toBeNull();
  });

  it('has no srcset for a product without images', () => {
    render(<ProductImage alt="Kurtka" />);
    expect(screen.getByRole('img', { hidden: true }).getAttribute('srcset')).toBeNull();
  });

  it('is lazy with no priority by default', () => {
    render(<ProductImage image={image} alt="Kurtka" />);

    const element = screen.getByRole('img', { hidden: true });
    expect(element.getAttribute('loading')).toBe('lazy');
    expect(element.getAttribute('fetchpriority')).toBeNull();
  });

  it('marks a likely LCP image', () => {
    render(<ProductImage image={image} alt="Kurtka" priority="high" />);

    const element = screen.getByRole('img', { hidden: true });
    expect(element.getAttribute('loading')).toBe('eager');
    expect(element.getAttribute('fetchpriority')).toBe('high');
  });

  it('keeps its size so the layout does not move', () => {
    render(<ProductImage image={image} alt="Kurtka" />);

    const element = screen.getByRole('img', { hidden: true });
    expect(element.getAttribute('width')).toBe('600');
    expect(element.getAttribute('height')).toBe('800');
  });
});
