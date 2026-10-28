import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import FormField from '../common/FormField';
import { propertyTypeOptions, purposeOptions } from '../../data/propertyOptions';
import { buildListingSearchParams } from '../../services/searchParams';

export default function PropertySearch() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    location: '',
    type: '',
    purpose: '',
    minPrice: '',
    maxPrice: '',
  });
  const [error, setError] = useState('');

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError('');
  };

  const handleClear = () => {
    setValues({ location: '', type: '', purpose: '', minPrice: '', maxPrice: '' });
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const minPrice = values.minPrice === '' ? null : Number(values.minPrice);
    const maxPrice = values.maxPrice === '' ? null : Number(values.maxPrice);

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      setError('The minimum price cannot be greater than the maximum price.');
      return;
    }

    const params = buildListingSearchParams({
      location: values.location,
      type: values.type,
      purpose: values.purpose,
      minPrice,
      maxPrice,
    });
    navigate(`/properties${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <form className="property-search" onSubmit={handleSubmit} role="search" aria-label="Search properties">
      <div className="property-search__heading">
        <p className="eyebrow">Search the collection</p>
        <p className="property-search__hint">Find a home by place, type or budget.</p>
      </div>

      <div className="property-search__fields">
        <FormField
          label="Location or keyword"
          id="home-search-location"
          className="property-search__field property-search__field--location"
          value={values.location}
          onChange={updateField('location')}
          placeholder="Mumbai, Goa, villa…"
          autoComplete="off"
        />

        <FormField
          label="Property type"
          id="home-search-type"
          as="select"
          className="property-search__field"
          value={values.type}
          onChange={updateField('type')}
        >
          <option value="">All types</option>
          {propertyTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>

        <FormField
          label="Purpose"
          id="home-search-purpose"
          as="select"
          className="property-search__field"
          value={values.purpose}
          onChange={updateField('purpose')}
        >
          <option value="">Buy or rent</option>
          {purposeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField>

        <FormField
          label="Min price (₹)"
          id="home-search-min-price"
          type="number"
          min="0"
          step="100000"
          className="property-search__field property-search__field--price"
          value={values.minPrice}
          onChange={updateField('minPrice')}
          placeholder="Any"
        />

        <FormField
          label="Max price (₹)"
          id="home-search-max-price"
          type="number"
          min="0"
          step="100000"
          className="property-search__field property-search__field--price"
          value={values.maxPrice}
          onChange={updateField('maxPrice')}
          placeholder="Any"
          error={error || undefined}
        />

        <div className="property-search__actions">
          <button type="submit" className="button button--primary button--md property-search__submit">
            <Search size={17} aria-hidden="true" />
            Search
          </button>
          <button type="button" className="property-search__clear" onClick={handleClear}>
            <X size={15} aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
