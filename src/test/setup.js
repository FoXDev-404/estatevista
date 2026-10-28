import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement matchMedia. Components that respect reduced motion
// need a predictable implementation, and individual tests may override it.
const createMediaQueryList = (query, matches = false) => ({
  matches,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn((query) => createMediaQueryList(query)),
});

// These are used by the gallery, pagination and form error focus handling but
// are not implemented by jsdom.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

if (!window.confirm) {
  window.confirm = vi.fn(() => true);
}

afterEach(() => {
  cleanup();
});
