import { useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Wand2 } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';
import {
  buildUnitNumberPreview,
  unitAreaUnitOptions,
  unitStatusOptions,
  validateUnitNumberPattern,
} from '../../../services/inventorySelectors';

const EMPTY_FORM = {
  building_id: '',
  floor_from: '',
  floor_to: '',
  units_per_floor: '2',
  number_pattern: '{floor}{number}',
  number_padding: '2',
  unit_type_id: '',
  area: '',
  area_unit: 'sqft',
  bedrooms: '',
  bathrooms: '',
  sale_price: '',
  rent_price: '',
  status: 'available',
  description: '',
};

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function initialForm(buildings) {
  const first = buildings[0];
  const floors = first?.floors || [];
  return {
    ...EMPTY_FORM,
    building_id: first?.id || '',
    floor_from: floors[0]?.number ?? '',
    floor_to: floors[floors.length - 1]?.number ?? '',
    number_pattern: first ? `${first.code}-{floor}{number}` : '{floor}{number}',
  };
}

export default function GenerateUnitsModal({
  project,
  buildings = [],
  unitTypes = [],
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(buildings));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [patternAuto, setPatternAuto] = useState(true);

  const building = buildings.find((row) => row.id === form.building_id) || null;
  const floors = useMemo(() => building?.floors || [], [building]);

  const totalUnits = useMemo(() => {
    const from = Number(form.floor_from);
    const to = Number(form.floor_to);
    const perFloor = Number(form.units_per_floor);
    if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(perFloor)) return 0;
    const selected = floors.filter((floor) => floor.number >= from && floor.number <= to);
    return selected.length * Math.max(perFloor, 0);
  }, [floors, form.floor_from, form.floor_to, form.units_per_floor]);

  const preview = useMemo(
    () =>
      buildUnitNumberPreview({
        floorFrom: form.floor_from,
        floorTo: form.floor_to,
        unitsPerFloor: form.units_per_floor,
        pattern: form.number_pattern,
        padding: form.number_padding,
      }),
    [form.floor_from, form.floor_to, form.units_per_floor, form.number_pattern, form.number_padding],
  );

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      if (field === 'building_id') {
        const next = buildings.find((row) => row.id === value);
        const nextFloors = next?.floors || [];
        setForm((current) => ({
          ...current,
          building_id: value,
          floor_from: nextFloors[0]?.number ?? '',
          floor_to: nextFloors[nextFloors.length - 1]?.number ?? '',
          number_pattern:
            patternAuto && next ? `${next.code}-{floor}{number}` : current.number_pattern,
        }));
      } else {
        if (field === 'number_pattern') setPatternAuto(false);
        setForm((current) => ({ ...current, [field]: value }));
      }
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const patternError = validateUnitNumberPattern(form.number_pattern);
    if (!form.building_id || !floors.length) {
      setErrors({ building_id: 'Choose a building that has floors.' });
      return;
    }
    if (!totalUnits) {
      setErrors({ floor_to: 'Choose a floor range with at least one unit.' });
      return;
    }
    if (totalUnits > 200) {
      setErrors({ units_per_floor: 'Generate at most 200 units at a time.' });
      return;
    }
    if (patternError) {
      setErrors({ number_pattern: patternError });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const result = await inventoryApiService.generateUnits(project.id, {
        building_id: form.building_id,
        floor_from: Number(form.floor_from),
        floor_to: Number(form.floor_to),
        units_per_floor: Number(form.units_per_floor),
        number_pattern: form.number_pattern,
        number_padding: Number(form.number_padding),
        unit_type_id: form.unit_type_id || null,
        area: numericOrNull(form.area),
        area_unit: form.area_unit,
        bedrooms: numericOrNull(form.bedrooms),
        bathrooms: numericOrNull(form.bathrooms),
        sale_price: numericOrNull(form.sale_price) ?? 0,
        rent_price: numericOrNull(form.rent_price) ?? 0,
        status: form.status,
        description: form.description || null,
      });
      addToast(`${result.meta?.created || result.data.length} units were generated.`, 'success');
      onSaved?.(result.data);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The units could not be generated.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Generate units"
      description="Create a numbered set of units across a floor range. Existing unit numbers are never overwritten."
      size="large"
      footer={
        <>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="generate-units-form"
            className="button button--primary button--md"
            disabled={saving || !buildings.length}
          >
            {saving ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <Wand2 size={16} aria-hidden="true" />
            )}
            {saving ? 'Generating…' : `Generate ${totalUnits || ''} units`}
          </button>
        </>
      }
    >
      {!buildings.length ? (
        <div className="admin-alert" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <p>Add a building with at least one floor before generating units.</p>
        </div>
      ) : (
        <form id="generate-units-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-grid admin-form-grid--two">
            <FormField
              label="Building"
              id="generate-building"
              as="select"
              value={form.building_id}
              onChange={updateField('building_id')}
              error={errors.building_id}
              required
            >
              <option value="">Choose a building</option>
              {buildings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} — {row.name} ({row.floors.length} floors)
                </option>
              ))}
            </FormField>

            <FormField
              label="Units per floor"
              id="generate-units-per-floor"
              type="number"
              min="1"
              max="100"
              step="1"
              value={form.units_per_floor}
              onChange={updateField('units_per_floor')}
              error={errors.units_per_floor}
              required
            />

            <FormField
              label="From floor"
              id="generate-floor-from"
              as="select"
              value={form.floor_from}
              onChange={updateField('floor_from')}
              error={errors.floor_from}
              disabled={!floors.length}
            >
              <option value="">Choose a floor</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.number}>
                  Floor {floor.number}
                  {floor.name ? ` — ${floor.name}` : ''}
                </option>
              ))}
            </FormField>

            <FormField
              label="To floor"
              id="generate-floor-to"
              as="select"
              value={form.floor_to}
              onChange={updateField('floor_to')}
              error={errors.floor_to}
              disabled={!floors.length}
            >
              <option value="">Choose a floor</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.number}>
                  Floor {floor.number}
                  {floor.name ? ` — ${floor.name}` : ''}
                </option>
              ))}
            </FormField>

            <FormField
              label="Number pattern"
              id="generate-pattern"
              value={form.number_pattern}
              onChange={updateField('number_pattern')}
              error={errors.number_pattern}
              hint="Use {floor} and {number}. Example: A-{floor}{number}."
              required
            />

            <FormField
              label="Number padding"
              id="generate-padding"
              type="number"
              min="1"
              max="6"
              step="1"
              value={form.number_padding}
              onChange={updateField('number_padding')}
              error={errors.number_padding}
            />

            <FormField
              label="Unit type"
              id="generate-type"
              as="select"
              value={form.unit_type_id}
              onChange={updateField('unit_type_id')}
              error={errors.unit_type_id}
            >
              <option value="">Not set</option>
              {unitTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </FormField>

            <FormField
              label="Starting status"
              id="generate-status"
              as="select"
              value={form.status}
              onChange={updateField('status')}
              error={errors.status}
            >
              {unitStatusOptions
                .filter((option) => ['available', 'draft'].includes(option.value))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </FormField>

            <FormField
              label="Area"
              id="generate-area"
              type="number"
              min="0"
              step="0.01"
              value={form.area}
              onChange={updateField('area')}
              error={errors.area}
            />

            <FormField
              label="Area unit"
              id="generate-area-unit"
              as="select"
              value={form.area_unit}
              onChange={updateField('area_unit')}
              error={errors.area_unit}
            >
              {unitAreaUnitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>

            <FormField
              label="Bedrooms"
              id="generate-bedrooms"
              type="number"
              min="0"
              step="1"
              value={form.bedrooms}
              onChange={updateField('bedrooms')}
              error={errors.bedrooms}
            />

            <FormField
              label="Bathrooms"
              id="generate-bathrooms"
              type="number"
              min="0"
              step="1"
              value={form.bathrooms}
              onChange={updateField('bathrooms')}
              error={errors.bathrooms}
            />

            <FormField
              label="Sale price"
              id="generate-sale-price"
              type="number"
              min="0"
              step="0.01"
              value={form.sale_price}
              onChange={updateField('sale_price')}
              error={errors.sale_price}
            />

            <FormField
              label="Rent price"
              id="generate-rent-price"
              type="number"
              min="0"
              step="0.01"
              value={form.rent_price}
              onChange={updateField('rent_price')}
              error={errors.rent_price}
            />

            <FormField
              label="Description"
              id="generate-description"
              as="textarea"
              rows={2}
              className="admin-form-grid__full"
              value={form.description}
              onChange={updateField('description')}
              error={errors.description}
            />
          </div>

          <div className="admin-generate-preview">
            <div className="admin-generate-preview__heading">
              <strong>Preview</strong>
              <span>
                {totalUnits} unit{totalUnits === 1 ? '' : 's'} across the selected floors
              </span>
            </div>
            {preview.length ? (
              <div className="admin-tag-list">
                {preview.map((number) => (
                  <span key={number} className="admin-tag">
                    {number}
                  </span>
                ))}
                {totalUnits > preview.length ? (
                  <span className="admin-tag admin-tag--muted">+{totalUnits - preview.length} more</span>
                ) : null}
              </div>
            ) : (
              <p className="admin-modal-note">
                Choose a valid pattern and floor range to preview the unit numbers.
              </p>
            )}
          </div>

          {Object.values(errors).some(Boolean) ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <p>Please correct the highlighted fields.</p>
            </div>
          ) : null}
        </form>
      )}
    </Modal>
  );
}
