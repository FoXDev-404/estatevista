import {
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Hash,
  Maximize2,
  Tag,
} from 'lucide-react';
import { formatArea, formatDate } from '../../services/formatters';
import { propertyTypeLabels, purposeLabels } from '../../data/propertyOptions';

export default function PropertySpecifications({ property }) {
  if (!property) return null;

  const items = [
    {
      label: 'Property type',
      value: propertyTypeLabels[property.type] || property.type,
      icon: Building2,
    },
    {
      label: 'Purpose',
      value: purposeLabels[property.purpose] || property.purpose,
      icon: Tag,
    },
    property.specifications?.bedrooms > 0
      ? {
          label: 'Bedrooms',
          value: property.specifications.bedrooms,
          icon: BedDouble,
        }
      : null,
    property.specifications?.bathrooms > 0
      ? {
          label: 'Bathrooms',
          value: property.specifications.bathrooms,
          icon: Bath,
        }
      : null,
    {
      label: 'Area',
      value: formatArea(property.specifications?.area, property.specifications?.areaUnit),
      icon: Maximize2,
    },
    {
      label: 'Reference',
      value: property.id,
      icon: Hash,
    },
    {
      label: 'Listed',
      value: formatDate(property.createdAt),
      icon: CalendarDays,
    },
  ].filter(Boolean);

  return (
    <dl className="property-specs">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className="property-specs__item" key={item.label}>
            <span className="property-specs__icon" aria-hidden="true">
              <Icon size={18} strokeWidth={1.4} />
            </span>
            <div>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
