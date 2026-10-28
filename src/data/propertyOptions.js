export const propertyTypeOptions = [
  { value: 'apartment', label: 'Apartment', plural: 'Apartments' },
  { value: 'house', label: 'Independent house', plural: 'Independent houses' },
  { value: 'villa', label: 'Villa', plural: 'Villas' },
  { value: 'plot', label: 'Residential plot', plural: 'Residential plots' },
  { value: 'commercial', label: 'Commercial space', plural: 'Commercial spaces' },
];

export const purposeOptions = [
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
];

export const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
  { value: 'unavailable', label: 'Unavailable' },
];

export const areaUnitOptions = [
  { value: 'sqft', label: 'sq ft' },
  { value: 'sqm', label: 'sq m' },
  { value: 'sqyd', label: 'sq yd' },
  { value: 'acres', label: 'acres' },
];

export const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

export const propertyTypeLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.label]),
);

export const propertyTypePluralLabels = Object.fromEntries(
  propertyTypeOptions.map((option) => [option.value, option.plural]),
);

export const purposeLabels = Object.fromEntries(
  purposeOptions.map((option) => [option.value, option.label]),
);

export const statusLabels = Object.fromEntries(
  statusOptions.map((option) => [option.value, option.label]),
);

export const areaUnitLabels = Object.fromEntries(
  areaUnitOptions.map((option) => [option.value, option.label]),
);

export const propertyTypeValues = propertyTypeOptions.map((option) => option.value);
export const purposeValues = purposeOptions.map((option) => option.value);
export const statusValues = statusOptions.map((option) => option.value);
export const areaUnitValues = areaUnitOptions.map((option) => option.value);
export const sortValues = sortOptions.map((option) => option.value);
