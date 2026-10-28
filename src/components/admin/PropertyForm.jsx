import { useEffect, useState } from 'react';
import {
  LoaderCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import FormField from '../common/FormField';
import {
  emptyPropertyFormValues,
  propertyToFormValues,
  validatePropertyForm,
} from '../../services/propertyForm';
import { slugify } from '../../services/validation';
import {
  PropertyStorageError,
  PropertyValidationError,
} from '../../services/propertyRepository';
import {
  areaUnitOptions,
  propertyTypeOptions,
  purposeOptions,
  statusOptions,
} from '../../data/propertyOptions';

const fieldOrder = [
  'title',
  'slug',
  'type',
  'purpose',
  'price',
  'status',
  'city',
  'area',
  'address',
  'bedrooms',
  'bathrooms',
  'areaSize',
  'areaUnit',
  'description',
  'images',
  'amenities',
  'facilities',
];

const focusField = (field) => {
  const element = document.getElementById(`property-form-${field}`);
  if (element && typeof element.focus === 'function') {
    element.focus();
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }
};

export default function AdminPropertyForm({
  property = null,
  mode = 'create',
  existingProperties = [],
  onSubmit,
  onCancel,
  submitLabel = 'Save property',
}) {
  const [initialValues] = useState(() =>
    property ? propertyToFormValues(property) : { ...emptyPropertyFormValues },
  );
  const [values, setValues] = useState(initialValues);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (formError) setFormError('');
  };

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    clearError(field);
  };

  const updateTitle = (event) => {
    const title = event.target.value;
    setValues((current) => ({
      ...current,
      title,
      ...(slugTouched ? {} : { slug: slugify(title) }),
    }));
    clearError('title');
    if (!slugTouched) clearError('slug');
  };

  const updateSlug = (event) => {
    setSlugTouched(true);
    setValues((current) => ({ ...current, slug: event.target.value.toLowerCase() }));
    clearError('slug');
  };

  const generateSlug = () => {
    setValues((current) => ({ ...current, slug: slugify(current.title) }));
    setSlugTouched(true);
    clearError('slug');
  };

  const updateCheckbox = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.checked }));
  };

  const applyServerErrors = (fieldErrors) => {
    setErrors(fieldErrors);
    const firstField = fieldOrder.find((field) => fieldErrors[field]);
    if (firstField) focusField(firstField);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validatePropertyForm(values, {
      properties: existingProperties,
      originalProperty: property,
    });

    if (!validation.isValid) {
      applyServerErrors(validation.errors);
      setFormError('Some fields need attention before this property can be saved.');
      return;
    }

    setErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      await onSubmit(validation.property);
    } catch (error) {
      if (error instanceof PropertyValidationError) {
        applyServerErrors(error.errors);
        setFormError('The property could not be saved because some fields are invalid.');
      } else if (error instanceof PropertyStorageError) {
        setFormError(error.message);
      } else {
        setFormError(error?.message || 'The property could not be saved. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (
      isDirty &&
      typeof window !== 'undefined' &&
      typeof window.confirm === 'function' &&
      !window.confirm('You have unsaved changes. Discard them and leave this form?')
    ) {
      return;
    }
    onCancel();
  };

  const slugPreview = values.slug || slugify(values.title) || 'property-slug';

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
      {Object.keys(errors).length > 0 || formError ? (
        <div className="admin-form__error-summary" role="alert">
          <strong>{formError || 'Review the highlighted fields.'}</strong>
          <p>
            {Object.keys(errors).length > 0
              ? `${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? '' : 's'} need attention.`
              : 'Your changes have not been saved.'}
          </p>
        </div>
      ) : null}

      <section className="admin-form-section" aria-labelledby="form-essentials-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">01</span>
          <div>
            <h2 id="form-essentials-title">Property essentials</h2>
            <p>The headline details shown across the marketplace.</p>
          </div>
        </div>

        <div className="admin-form-grid">
          <FormField
            label="Property title"
            id="property-form-title"
            value={values.title}
            onChange={updateTitle}
            error={errors.title}
            required
            className="admin-form-grid__full"
            placeholder="The Arbour Residence"
            autoComplete="off"
          />

          <FormField
            label="Slug"
            id="property-form-slug"
            value={values.slug}
            onChange={updateSlug}
            error={errors.slug}
            required
            className="admin-form-grid__full"
            placeholder="the-arbour-residence-worli"
            hint={`Public URL: /properties/${slugPreview}`}
            autoComplete="off"
          />
          <div className="admin-form__slug-action">
            <button type="button" className="text-button" onClick={generateSlug}>
              <Sparkles size={14} aria-hidden="true" />
              Generate slug from title
            </button>
          </div>

          <FormField
            label="Property type"
            id="property-form-type"
            as="select"
            value={values.type}
            onChange={updateField('type')}
            error={errors.type}
            required
          >
            {propertyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>

          <FormField
            label="Purpose"
            id="property-form-purpose"
            as="select"
            value={values.purpose}
            onChange={updateField('purpose')}
            error={errors.purpose}
            required
          >
            {purposeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>

          <FormField
            label="Price (INR)"
            id="property-form-price"
            type="number"
            min="0"
            step="1000"
            value={values.price}
            onChange={updateField('price')}
            error={errors.price}
            required
            hint={values.purpose === 'rent' ? 'Monthly rent in Indian rupees.' : 'Sale price in Indian rupees.'}
          />

          <FormField
            label="Status"
            id="property-form-status"
            as="select"
            value={values.status}
            onChange={updateField('status')}
            error={errors.status}
            required
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="form-location-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">02</span>
          <div>
            <h2 id="form-location-title">Location</h2>
            <p>City, locality and the address displayed on the property page.</p>
          </div>
        </div>

        <div className="admin-form-grid">
          <FormField
            label="City"
            id="property-form-city"
            value={values.city}
            onChange={updateField('city')}
            error={errors.city}
            required
            placeholder="Mumbai"
          />
          <FormField
            label="Area or locality"
            id="property-form-area"
            value={values.area}
            onChange={updateField('area')}
            error={errors.area}
            required
            placeholder="Worli"
          />
          <FormField
            label="Full address"
            id="property-form-address"
            value={values.address}
            onChange={updateField('address')}
            error={errors.address}
            required
            className="admin-form-grid__full"
            placeholder="14 Marine Crescent, Worli, Mumbai 400018"
          />
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="form-space-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">03</span>
          <div>
            <h2 id="form-space-title">Space & specifications</h2>
            <p>Use 0 bedrooms and bathrooms for plots or land.</p>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--four">
          <FormField
            label="Bedrooms"
            id="property-form-bedrooms"
            type="number"
            min="0"
            step="1"
            value={values.bedrooms}
            onChange={updateField('bedrooms')}
            error={errors.bedrooms}
            required
          />
          <FormField
            label="Bathrooms"
            id="property-form-bathrooms"
            type="number"
            min="0"
            step="1"
            value={values.bathrooms}
            onChange={updateField('bathrooms')}
            error={errors.bathrooms}
            required
          />
          <FormField
            label="Area"
            id="property-form-areaSize"
            type="number"
            min="1"
            step="1"
            value={values.areaSize}
            onChange={updateField('areaSize')}
            error={errors.areaSize}
            required
          />
          <FormField
            label="Area unit"
            id="property-form-areaUnit"
            as="select"
            value={values.areaUnit}
            onChange={updateField('areaUnit')}
            error={errors.areaUnit}
            required
          >
            {areaUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="form-story-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">04</span>
          <div>
            <h2 id="form-story-title">Description & images</h2>
            <p>Write with care. Images should be local paths or complete http(s) URLs.</p>
          </div>
        </div>

        <div className="admin-form-grid">
          <FormField
            label="Description"
            id="property-form-description"
            as="textarea"
            rows="6"
            value={values.description}
            onChange={updateField('description')}
            error={errors.description}
            required
            className="admin-form-grid__full"
            hint="At least 20 characters. This text appears on the property detail page."
            placeholder="Describe the home, its setting and what makes it distinctive."
          />
          <FormField
            label="Image paths or URLs"
            id="property-form-images"
            as="textarea"
            rows="5"
            value={values.images}
            onChange={updateField('images')}
            error={errors.images}
            className="admin-form-grid__full"
            hint="One image per line. Example: /images/property-1.jpg"
            placeholder="/images/property-1.jpg&#10;/images/property-2.jpg"
          />
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="form-features-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">05</span>
          <div>
            <h2 id="form-features-title">Amenities & facilities</h2>
            <p>One item per line. These are displayed as separate lists on the property page.</p>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Amenities"
            id="property-form-amenities"
            as="textarea"
            rows="5"
            value={values.amenities}
            onChange={updateField('amenities')}
            error={errors.amenities}
            hint="Example: Private pool, Sea view, Study"
            placeholder="Private pool&#10;Landscaped garden&#10;Outdoor dining"
          />
          <FormField
            label="Facilities"
            id="property-form-facilities"
            as="textarea"
            rows="5"
            value={values.facilities}
            onChange={updateField('facilities')}
            error={errors.facilities}
            hint="Example: Power backup, Security, Visitor parking"
            placeholder="Power backup&#10;Rainwater harvesting&#10;24×7 security"
          />
        </div>
      </section>

      <section className="admin-form-section" aria-labelledby="form-visibility-title">
        <div className="admin-form-section__heading">
          <span className="admin-form-section__number">06</span>
          <div>
            <h2 id="form-visibility-title">Visibility</h2>
            <p>Flags control the featured and trending sections on the homepage.</p>
          </div>
        </div>

        <div className="admin-form-checks">
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={values.featured}
              onChange={updateCheckbox('featured')}
            />
            <span>
              <strong>Featured property</strong>
              <small>Include in featured collections when the property is available.</small>
            </span>
          </label>
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={values.trending}
              onChange={updateCheckbox('trending')}
            />
            <span>
              <strong>Trending property</strong>
              <small>Include in trending sections when the property is available.</small>
            </span>
          </label>
        </div>
      </section>

      <div className="admin-form__actions">
        <button type="button" className="button button--secondary button--md" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="button button--primary button--md" disabled={isSubmitting}>
          {isSubmitting ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>

      {isDirty ? (
        <p className="admin-form__dirty-note">Unsaved changes will be lost if you leave this page.</p>
      ) : null}
    </form>
  );
}
