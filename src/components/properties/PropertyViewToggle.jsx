import { LayoutGrid, Rows3 } from 'lucide-react';

const viewOptions = [
  { value: 'grid', label: 'Grid view', Icon: LayoutGrid },
  { value: 'list', label: 'List view', Icon: Rows3 },
];

export default function PropertyViewToggle({ value = 'grid', onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label="Property layout">
      {viewOptions.map((option) => {
        const { value: optionValue, label, Icon } = option;
        const isActive = value === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            className="view-toggle__button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => onChange?.(optionValue)}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
