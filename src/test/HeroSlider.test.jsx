import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeroSlider from '../components/home/HeroSlider';
import heroSlides from '../data/hero-slides';

const slides = heroSlides.filter((slide) => slide.isActive !== false);

const mockReducedMotion = (matches) => {
  window.matchMedia = vi.fn((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const renderHero = () =>
  render(
    <MemoryRouter>
      <HeroSlider />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.useRealTimers();
  mockReducedMotion(false);
});

describe('HeroSlider', () => {
  it('renders an accessible carousel and changes slides with the controls', async () => {
    const user = userEvent.setup();
    renderHero();

    const carousel = screen.getByRole('region', {
      name: /featured properties and places/i,
    });
    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[0].heading);

    await user.click(screen.getByRole('button', { name: /next slide/i }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[1].heading);
    expect(screen.getByRole('button', { name: new RegExp(`show slide 2:`, 'i') })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: new RegExp(`show slide 4:`, 'i') }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[3].heading);

    await user.click(screen.getByRole('button', { name: /previous slide/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[2].heading);
  });

  it('advances automatically after the slide duration', () => {
    vi.useFakeTimers();
    renderHero();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[0].heading);

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[1].heading);
  });

  it('pauses autoplay from the pause control', () => {
    vi.useFakeTimers();
    renderHero();

    fireEvent.click(screen.getByRole('button', { name: /pause slideshow/i }));
    act(() => {
      vi.advanceTimersByTime(14000);
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[0].heading);
    expect(screen.getByRole('button', { name: /play slideshow/i })).toBeInTheDocument();
  });

  it('disables autoplay and hides the pause control for reduced motion', () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    renderHero();

    expect(screen.queryByRole('button', { name: /pause slideshow/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(21000);
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(slides[0].heading);
  });
});
