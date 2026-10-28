import { ArrowUpDown } from 'lucide-react';
import { sortOptions } from '../../data/propertyOptions';

export default function PropertySort({ value = 'newest', onChange }) {
  return (
    <div className="property-sort">
      <label htmlFor="property-sort" className="property-sort__label">
        <ArrowUpDown size={15} aria-hidden="true" />
        Sort by
      </label>
      <select
        id="property-sort"
        className="property-sort__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
