import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import Container from '../components/common/Container';
import PageHeader from '../components/common/PageHeader';
import PageMeta from '../components/common/PageMeta';
import EmptyState from '../components/common/EmptyState';
import PropertyFilters from '../components/properties/PropertyFilters';
import PropertySort from '../components/properties/PropertySort';
import PropertyViewToggle from '../components/properties/PropertyViewToggle';
import PropertyGrid from '../components/properties/PropertyGrid';
import Pagination from '../components/properties/Pagination';
import useProperties from '../hooks/useProperties';
import { getAvailableProperties, filterProperties, paginateProperties, sortProperties } from '../services/propertySelectors';
import {
  buildListingSearchParams,
  getActiveFilterCount,
  parseListingSearchParams,
} from '../services/searchParams';
import { formatPrice } from '../services/formatters';
import {
  propertyTypePluralLabels,
  purposeLabels,
} from '../data/propertyOptions';

const PAGE_SIZE = 6;

function PropertySearchForm({ query, onSubmit }) {
  const [draft, setDraft] = useState(query);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(draft.trim());
  };

  const handleChange = (event) => {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
  };

  const clearSearch = () => {
    setDraft('');
    onSubmit('');
  };

  return (
    <form className="listing-search" role="search" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="listing-search-input">
        Search properties by title, city or area
      </label>
      <Search size={20} className="listing-search__icon" aria-hidden="true" />
      <input
        id="listing-search-input"
        type="search"
        value={draft}
        onChange={handleChange}
        placeholder="Search by title, city, area or feature…"
        autoComplete="off"
      />
      {draft ? (
        <button
          type="button"
          className="listing-search__clear"
          onClick={clearSearch}
          aria-label="Clear search"
        >
          <X size={17} aria-hidden="true" />
        </button>
      ) : null}
      <button type="submit" className="button button--primary button--sm">
        Search
      </button>
    </form>
  );
}

export default function Properties() {
  const { properties } = useProperties();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseListingSearchParams(searchParams), [searchParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState('grid');

  const applyFilters = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      if (patch.page === undefined) next.page = 1;
      const params = buildListingSearchParams(next);
      setSearchParams(params, { replace: true });
    },
    [filters, setSearchParams],
  );

  const matchingProperties = useMemo(
    () => sortProperties(filterProperties(properties, filters), filters.sort),
    [properties, filters],
  );

  const pagination = useMemo(
    () => paginateProperties(matchingProperties, filters.page, PAGE_SIZE),
    [matchingProperties, filters.page],
  );

  useEffect(() => {
    if (filters.page !== pagination.page) {
      const params = buildListingSearchParams({ ...filters, page: pagination.page });
      setSearchParams(params, { replace: true });
    }
  }, [filters, pagination.page, setSearchParams]);

  const clearAll = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setFiltersOpen(false);
  };

  const removeFilter = (key) => {
    if (key === 'featured') {
      applyFilters({ featured: false, page: 1 });
      return;
    }
    applyFilters({ [key]: key === 'minPrice' || key === 'maxPrice' ? null : '', page: 1 });
  };

  const activeCount = getActiveFilterCount(filters);
  const availableCount = getAvailableProperties(properties).length;

  const chips = [];
  if (filters.q) chips.push({ key: 'q', label: `Keyword: ${filters.q}` });
  if (filters.location) chips.push({ key: 'location', label: `Location: ${filters.location}` });
  if (filters.type) {
    chips.push({ key: 'type', label: propertyTypePluralLabels[filters.type] || filters.type });
  }
  if (filters.purpose) {
    chips.push({ key: 'purpose', label: purposeLabels[filters.purpose] || filters.purpose });
  }
  if (filters.minPrice !== null) {
    chips.push({ key: 'minPrice', label: `Min ${formatPrice(filters.minPrice)}` });
  }
  if (filters.maxPrice !== null) {
    chips.push({ key: 'maxPrice', label: `Max ${formatPrice(filters.maxPrice)}` });
  }
  if (filters.featured) chips.push({ key: 'featured', label: 'Featured only' });

  return (
    <>
      <PageMeta
        title="Properties"
        description="Browse available apartments, houses, villas, plots and commercial spaces in the EstateVista collection."
        image="/images/hero-1.jpg"
      />
      <PageHeader
        eyebrow="The collection"
        title="Places that feel like possibility."
        description="Explore available apartments, houses, villas, land and commercial spaces from across the EstateVista collection. Refine by place, type, purpose or price."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Properties' }]}
        aside={
          <div className="collection-count">
            <span className="collection-count__number">{availableCount}</span>
            <span className="collection-count__label">
              available {availableCount === 1 ? 'property' : 'properties'}
            </span>
          </div>
        }
      />

      <section className="listings section">
        <Container>
          <PropertySearchForm
            key={filters.q}
            query={filters.q}
            onSubmit={(query) => applyFilters({ q: query, page: 1 })}
          />

          <div className="listing-toolbar">
            <p className="listing-toolbar__count" role="status" aria-live="polite">
              {pagination.totalItems === 0 ? (
                'No properties match'
              ) : (
                <>
                  Showing{' '}
                  <strong>
                    {pagination.rangeStart}–{pagination.rangeEnd}
                  </strong>{' '}
                  of <strong>{pagination.totalItems}</strong>{' '}
                  {pagination.totalItems === 1 ? 'property' : 'properties'}
                </>
              )}
            </p>
            <div className="listing-toolbar__controls">
              {activeCount > 0 ? (
                <button type="button" className="listing-toolbar__clear" onClick={clearAll}>
                  Clear all
                </button>
              ) : null}
              <PropertyViewToggle value={view} onChange={setView} />
              <PropertySort
                value={filters.sort}
                onChange={(sort) => applyFilters({ sort, page: 1 })}
              />
            </div>
          </div>

          <div className="listing-layout">
            <PropertyFilters
              filters={filters}
              onChange={applyFilters}
              onClear={clearAll}
              activeCount={activeCount}
              isOpen={filtersOpen}
              onToggle={() => setFiltersOpen((open) => !open)}
            />

            <div className="listing-results" id="listings-results">
              {chips.length > 0 ? (
                <div className="active-filters" aria-label="Active filters">
                  <span className="active-filters__label">Active filters</span>
                  <ul>
                    {chips.map((chip) => (
                      <li key={chip.key}>
                        <button
                          type="button"
                          className="filter-chip"
                          onClick={() => removeFilter(chip.key)}
                          aria-label={`Remove filter: ${chip.label}`}
                        >
                          {chip.label}
                          <X size={13} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="active-filters__clear" onClick={clearAll}>
                    Clear all
                  </button>
                </div>
              ) : null}

              {pagination.items.length > 0 ? (
                <>
                  <PropertyGrid properties={pagination.items} columns={2} view={view} />
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => {
                      applyFilters({ page });
                      window.setTimeout(() => {
                        document
                          .getElementById('listings-results')
                          ?.scrollIntoView({ block: 'start', behavior: 'auto' });
                      }, 0);
                    }}
                  />
                </>
              ) : (
                <EmptyState
                  title="No properties match these filters"
                  description={
                    availableCount === 0
                      ? 'There are currently no available properties. New records added in the property studio will appear here.'
                      : 'Try a different location, property type or price range, or clear the active filters to see the full collection.'
                  }
                  action={
                    <button type="button" className="button button--primary button--md" onClick={clearAll}>
                      Clear all filters
                    </button>
                  }
                />
              )}
            </div>
          </div>

          <div className="listings__footer-note">
            <p>
              Looking for something specific?{' '}
              <Link className="text-link" to="/contact">
                Tell us what you have in mind
              </Link>
              .
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
