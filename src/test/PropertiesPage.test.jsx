import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Properties from '../pages/Properties';
import PropertyProvider from '../context/PropertyProvider';
import seedProperties from '../data/properties';
import { filterProperties } from '../services/propertySelectors';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const renderProperties = (entry = '/properties') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PropertyProvider>
        <Properties />
        <LocationProbe />
      </PropertyProvider>
    </MemoryRouter>,
  );

const listingCount = () => document.querySelector('.listing-toolbar__count');

const availableCount = filterProperties(seedProperties, {}).length;
const villaCount = filterProperties(seedProperties, { type: 'villa' }).length;

describe('Properties page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists every available property and excludes unavailable records', () => {
    renderProperties();

    expect(document.querySelector('.collection-count__number')).toHaveTextContent(
      String(availableCount),
    );
    expect(document.querySelector('.collection-count__label')).toHaveTextContent(
      'available properties',
    );
    expect(listingCount()).toHaveTextContent(`Showing 1–6 of ${availableCount} properties`);

    const sold = seedProperties.find((property) => property.status === 'sold');
    if (sold) {
      expect(screen.queryByText(sold.title)).not.toBeInTheDocument();
    }
  });

  it('applies filters from the URL and exposes them as removable chips', async () => {
    const user = userEvent.setup();
    renderProperties('/properties?type=villa');

    expect(listingCount()).toHaveTextContent(`Showing 1–${villaCount} of ${villaCount} properties`);
    expect(screen.getByRole('button', { name: 'Remove filter: Villas' })).toBeInTheDocument();

    for (const property of filterProperties(seedProperties, { type: 'villa' })) {
      expect(screen.getByRole('heading', { level: 3, name: property.title })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Remove filter: Villas' }));

    await waitFor(() => {
      expect(listingCount()).toHaveTextContent(`of ${availableCount} properties`);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('');
  });

  it('submits a keyword search and keeps the URL in sync', async () => {
    const user = userEvent.setup();
    renderProperties();

    await user.type(
      screen.getByRole('searchbox', { name: /search properties/i }),
      'Villa Aurelia',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(listingCount()).toHaveTextContent('Showing 1–1 of 1 property');
    });
    expect(screen.getByRole('heading', { level: 3, name: 'Villa Aurelia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter: Keyword: Villa Aurelia' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?q=Villa+Aurelia');

    await user.click(screen.getByRole('button', { name: 'Remove filter: Keyword: Villa Aurelia' }));

    await waitFor(() => {
      expect(listingCount()).toHaveTextContent(`of ${availableCount} properties`);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('');
  });

  it('changes sorting from the toolbar', async () => {
    const user = userEvent.setup();
    renderProperties();

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'price-asc');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('?sort=price-asc');
    });
    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards[0]).toHaveTextContent('Lonavala Retreat Villa');
    expect(screen.getByTestId('location')).toHaveTextContent('?sort=price-asc');
  });

  it('switches between grid and list layouts', async () => {
    const user = userEvent.setup();
    renderProperties();

    const gridButton = screen.getByRole('button', { name: 'Grid view' });
    const listButton = screen.getByRole('button', { name: 'List view' });

    expect(gridButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('.property-grid')).not.toHaveClass('property-grid--list');

    await user.click(listButton);

    expect(gridButton).toHaveAttribute('aria-pressed', 'false');
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.property-grid')).toHaveClass('property-grid--list');
  });
});
