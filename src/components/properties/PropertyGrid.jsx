import PropertyCard from './PropertyCard';

export default function PropertyGrid({
  properties = [],
  columns = 3,
  view = 'grid',
  className = '',
}) {
  const classes = [
    'property-grid',
    `property-grid--${columns}`,
    view === 'list' ? 'property-grid--list' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
