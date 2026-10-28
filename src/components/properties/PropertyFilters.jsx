import { useState } from 'react';
import { FilterX, SlidersHorizontal, X } from 'lucide-react';
import {
  propertyTypeOptions,
  purposeOptions,
} from '../../data/propertyOptions';

function PriceFilter({ minPrice, maxPrice, onChange }) {
  const [minValue, setMinValue] = useState(minPrice === null ? '' : String(minPrice));
  const [maxValue, setMaxValue] = useState(maxPrice === null ? '' : String(maxPrice));
  const [priceError, setPriceError] = useState('');

  const applyPrice = (event) => {
    event.preventDefault();
    const parsedMin = minValue === '' ? null : Number(minValue);
    const parsedMax = maxValue === '' ? null : Number(maxValue);

    if (
      (parsedMin !== null && (!Number.isFinite(parsedMin) || parsedMin < 0)) ||
      (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax < 0))
    ) {
      setPriceError('Enter a valid, non-negative price.');
      return;
    }

    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setPriceError('The minimum price cannot be greater than the maximum price.');
      return;
    }

    setPriceError('');
    onChange({ minPrice: parsedMin, maxPrice: parsedMax, page: 1 });
  };

  return (
    <form className="filter-group filter-price" onSubmit={applyPrice}>
      <p className="filter-group__legend" id="price-range-label">
        Price range (₹)
      </p>
      <div className="filter-price__fields" role="group" aria-labelledby="price-range-label">
        <label className="filter-price__field">
          <span>Minimum</span>
          <input
            type="number"
            min="0"
            step="100000"
            value={minValue}
            onChange={(event) => {
              setMinValue(event.target.value);
              if (priceError) setPriceError('');
            }}
            placeholder="Any"
            aria-invalid={priceError ? true : undefined}
            aria-describedby={priceError ? 'price-filter-error' : undefined}
          />
        </label>
        <span className="filter-price__dash" aria-hidden="true">
          —
        </span>
        <label className="filter-price__field">
          <span>Maximum</span>
          <input
            type="number"
            min="0"
            step="100000"
            value={maxValue}
            onChange={(event) => {
              setMaxValue(event.target.value);
              if (priceError) setPriceError('');
            }}
            placeholder="Any"
            aria-invalid={priceError ? true : undefined}
            aria-describedby={priceError ? 'price-filter-error' : undefined}
          />
        </label>
      </div>
      {priceError ? (
        <p className="form-field__error" id="price-filter-error" role="alert">
          {priceError}
        </p>
      ) : null}
      <button type="submit" className="button button--secondary button--sm filter-price__apply">
        Apply price
      </button>
    </form>
  );
}

export default function PropertyFilters({
  filters,
  onChange,
  onClear,
  activeCount = 0,
  isOpen = false,
  onToggle,
}) {
  return (
    <aside className={`property-filters${isOpen ? ' is-open' : ''}`} aria-label="Property filters">
      <div className="property-filters__mobile-toggle">
        <button
          type="button"
          className="button button--secondary button--md"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="property-filter-panel"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
          Filters
          {activeCount > 0 ? <span className="filter-count">{activeCount}</span> : null}
        </button>
      </div>

      <div className="property-filters__panel" id="property-filter-panel">
        <div className="property-filters__heading">
          <div>
            <p className="property-filters__title">Refine the collection</p>
            {activeCount > 0 ? (
              <p className="property-filters__active-count">{activeCount} active</p>
            ) : null}
          </div>
          <button
            type="button"
            className="property-filters__clear"
            onClick={onClear}
            disabled={activeCount === 0}
          >
            <FilterX size={15} aria-hidden="true" />
            Clear
          </button>
        </div>

        <fieldset className="filter-group">
          <legend className="filter-group__legend">Property type</legend>
          <div className="filter-options">
            <label className="filter-option">
              <input
                type="radio"
                name="listing-type"
                value=""
                checked={!filters.type}
                onChange={() => onChange({ type: '', page: 1 })}
              />
              <span>All types</span>
            </label>
            {propertyTypeOptions.map((option) => (
              <label className="filter-option" key={option.value}>
                <input
                  type="radio"
                  name="listing-type"
                  value={option.value}
                  checked={filters.type === option.value}
                  onChange={() => onChange({ type: option.value, page: 1 })}
                />
                <span>{option.plural}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend className="filter-group__legend">Purpose</legend>
          <div className="filter-options filter-options--inline">
            <label className="filter-option">
              <input
                type="radio"
                name="listing-purpose"
                value=""
                checked={!filters.purpose}
                onChange={() => onChange({ purpose: '', page: 1 })}
              />
              <span>Buy or rent</span>
            </label>
            {purposeOptions.map((option) => (
              <label className="filter-option" key={option.value}>
                <input
                  type="radio"
                  name="listing-purpose"
                  value={option.value}
                  checked={filters.purpose === option.value}
                  onChange={() => onChange({ purpose: option.value, page: 1 })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <PriceFilter
          key={`${filters.minPrice}:${filters.maxPrice}`}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onChange={onChange}
        />

        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filters.featured === true}
            onChange={(event) => onChange({ featured: event.target.checked, page: 1 })}
          />
          <span>Featured properties only</span>
        </label>

        <button
          type="button"
          className="property-filters__close-mobile"
          onClick={onToggle}
        >
          <X size={16} aria-hidden="true" />
          Close filters
        </button>
      </div>
    </aside>
  );
}
