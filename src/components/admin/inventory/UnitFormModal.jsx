import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';
import { unitAreaUnitOptions, unitStatusOptions } from '../../../services/inventorySelectors';

const EMPTY_FORM = {
  project_id: '',
  unit_number: '',
  building_id: '',
  floor_id: '',
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

function toForm(unit, fixedProjectId) {
  if (!unit) return { ...EMPTY_FORM, project_id: fixedProjectId || '' };
  return {
    project_id: unit.project_id || unit.project?.id || fixedProjectId || '',
    unit_number: unit.unit_number || '',
    building_id: unit.building_id || unit.building?.id || '',
    floor_id: unit.floor_id || unit.floor?.id || '',
    unit_type_id: unit.unit_type_id || unit.unit_type?.id || '',
    area: unit.area ?? '',
    area_unit: unit.area_unit || 'sqft',
    bedrooms: unit.bedrooms ?? '',
    bathrooms: unit.bathrooms ?? '',
    sale_price: unit.sale_price ?? '',
    rent_price: unit.rent_price ?? '',
    status: unit.status || 'available',
    description: unit.description || '',
  };
}

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function UnitFormModal({
  onClose,
  onSaved,
  projects = [],
  unitTypes = [],
  initialUnit = null,
  fixedProjectId = '',
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => toForm(initialUnit, fixedProjectId));
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [buildingData, setBuildingData] = useState({ projectId: null, rows: [] });

  const editing = Boolean(initialUnit);
  const projectId = form.project_id;

  useEffect(() => {
    if (!projectId) return undefined;

    let ignore = false;
    inventoryApiService
      .listBuildings(projectId)
      .then((rows) => {
        if (!ignore) setBuildingData({ projectId, rows });
      })
      .catch(() => {
        if (!ignore) setBuildingData({ projectId, rows: [] });
      });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  const buildings = useMemo(
    () => (buildingData.projectId === projectId ? buildingData.rows : []),
    [buildingData, projectId],
  );
  const loadingBuildings = Boolean(projectId) && buildingData.projectId !== projectId;

  const floors = useMemo(() => {
    const building = buildings.find((row) => row.id === form.building_id);
    return building?.floors || [];
  }, [buildings, form.building_id]);

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        if (field === 'project_id') {
          return { ...current, project_id: value, building_id: '', floor_id: '' };
        }
        if (field === 'building_id') {
          return { ...current, building_id: value, floor_id: '' };
        }
        return { ...current, [field]: value };
      });
      setFormErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormErrors({});

    const payload = {
      unit_number: form.unit_number,
      building_id: form.building_id || null,
      floor_id: form.floor_id || null,
      unit_type_id: form.unit_type_id || null,
      area: numericOrNull(form.area),
      area_unit: form.area_unit,
      bedrooms: numericOrNull(form.bedrooms),
      bathrooms: numericOrNull(form.bathrooms),
      sale_price: numericOrNull(form.sale_price) ?? 0,
      rent_price: numericOrNull(form.rent_price) ?? 0,
      description: form.description || null,
    };
    if (!editing) {
      payload.project_id = form.project_id;
      payload.status = form.status;
    }

    try {
      const unit = editing
        ? await inventoryApiService.updateUnit(initialUnit.id, payload)
        : await inventoryApiService.createUnit(payload);
      addToast(
        editing ? `Unit ${unit.unit_number} was updated.` : `Unit ${unit.unit_number} was created.`,
        'success',
      );
      onSaved?.(unit, editing ? 'updated' : 'created');
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setFormErrors(error.fields || {});
      addToast(error.message || 'The unit could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit unit ${initialUnit?.unit_number || ''}` : 'New unit'}
      description={
        editing
          ? 'Update the unit details. Use the status action to move the unit and keep a history.'
          : 'Add a single unit to a project, or use generate units for a whole floor range.'
      }
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
            form="unit-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save unit' : 'Create unit'}
          </button>
        </>
      }
    >
      <form id="unit-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Project"
            id="unit-project"
            as="select"
            value={form.project_id}
            onChange={updateField('project_id')}
            error={formErrors.project_id}
            disabled={editing}
            required
          >
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.code || project.number}
              </option>
            ))}
          </FormField>

          <FormField
            label="Unit number"
            id="unit-number"
            value={form.unit_number}
            onChange={updateField('unit_number')}
            error={formErrors.unit_number}
            required
          />

          <FormField
            label="Building"
            id="unit-building"
            as="select"
            value={form.building_id}
            onChange={updateField('building_id')}
            error={formErrors.building_id}
            hint={loadingBuildings ? 'Loading buildings…' : undefined}
          >
            <option value="">No building</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.code} — {building.name}
              </option>
            ))}
          </FormField>

          <FormField
            label="Floor"
            id="unit-floor"
            as="select"
            value={form.floor_id}
            onChange={updateField('floor_id')}
            error={formErrors.floor_id}
            disabled={!form.building_id}
          >
            <option value="">No floor</option>
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                Floor {floor.number}
                {floor.name ? ` — ${floor.name}` : ''}
              </option>
            ))}
          </FormField>

          <FormField
            label="Unit type"
            id="unit-type"
            as="select"
            value={form.unit_type_id}
            onChange={updateField('unit_type_id')}
            error={formErrors.unit_type_id}
          >
            <option value="">Not set</option>
            {unitTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </FormField>

          {!editing ? (
            <FormField
              label="Starting status"
              id="unit-status"
              as="select"
              value={form.status}
              onChange={updateField('status')}
              error={formErrors.status}
              hint="Use the status action later to record a change."
            >
              {unitStatusOptions
                .filter((option) => ['available', 'draft'].includes(option.value))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </FormField>
          ) : null}

          <FormField
            label="Area"
            id="unit-area"
            type="number"
            min="0"
            step="0.01"
            value={form.area}
            onChange={updateField('area')}
            error={formErrors.area}
          />

          <FormField
            label="Area unit"
            id="unit-area-unit"
            as="select"
            value={form.area_unit}
            onChange={updateField('area_unit')}
            error={formErrors.area_unit}
          >
            {unitAreaUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>

          <FormField
            label="Bedrooms"
            id="unit-bedrooms"
            type="number"
            min="0"
            step="1"
            value={form.bedrooms}
            onChange={updateField('bedrooms')}
            error={formErrors.bedrooms}
          />

          <FormField
            label="Bathrooms"
            id="unit-bathrooms"
            type="number"
            min="0"
            step="1"
            value={form.bathrooms}
            onChange={updateField('bathrooms')}
            error={formErrors.bathrooms}
          />

          <FormField
            label="Sale price"
            id="unit-sale-price"
            type="number"
            min="0"
            step="0.01"
            value={form.sale_price}
            onChange={updateField('sale_price')}
            error={formErrors.sale_price}
          />

          <FormField
            label="Rent price"
            id="unit-rent-price"
            type="number"
            min="0"
            step="0.01"
            value={form.rent_price}
            onChange={updateField('rent_price')}
            error={formErrors.rent_price}
          />

          <FormField
            label="Description"
            id="unit-description"
            as="textarea"
            rows={3}
            className="admin-form-grid__full"
            value={form.description}
            onChange={updateField('description')}
            error={formErrors.description}
          />
        </div>

        {Object.values(formErrors).some(Boolean) ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>Please correct the highlighted fields.</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
