import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';

const EMPTY_FORM = { code: '', name: '', floors_count: '1' };

export default function BuildingFormModal({
  projectId,
  initialBuilding = null,
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() =>
    initialBuilding
      ? {
          code: initialBuilding.code || '',
          name: initialBuilding.name || '',
          floors_count: String(initialBuilding.floors_count || 1),
        }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const editing = Boolean(initialBuilding);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = { code: form.code, name: form.name };
      if (!editing) payload.floors_count = Number(form.floors_count);
      const building = editing
        ? await inventoryApiService.updateBuilding(projectId, initialBuilding.id, payload)
        : await inventoryApiService.createBuilding(projectId, payload);
      addToast(
        editing
          ? `Building ${building.code} was updated.`
          : `Building ${building.code} was added with ${building.floors.length} floors.`,
        'success',
      );
      onSaved?.(building);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The building could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit building ${initialBuilding?.code || ''}` : 'Add building'}
      description={
        editing
          ? 'Rename the building or change its code. Floors are managed individually.'
          : 'Floors are created automatically from 1 up to the floor count.'
      }
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
            form="building-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save building' : 'Add building'}
          </button>
        </>
      }
    >
      <form id="building-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Building code"
            id="building-code"
            value={form.code}
            onChange={updateField('code')}
            error={errors.code}
            hint="Short label used in unit numbers, for example A."
            required
          />
          <FormField
            label="Building name"
            id="building-name"
            value={form.name}
            onChange={updateField('name')}
            error={errors.name}
            required
          />
          {!editing ? (
            <FormField
              label="Floors"
              id="building-floors"
              type="number"
              min="1"
              max="100"
              step="1"
              value={form.floors_count}
              onChange={updateField('floors_count')}
              error={errors.floors_count}
              hint="Creates floors 1 to this number."
            />
          ) : null}
        </div>

        {Object.values(errors).some(Boolean) ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>Please correct the highlighted fields.</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
