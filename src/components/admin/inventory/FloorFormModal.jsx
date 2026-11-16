import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';

export default function FloorFormModal({
  projectId,
  building,
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => {
    const highest = (building?.floors || []).reduce(
      (max, floor) => Math.max(max, Number(floor.number) || 0),
      0,
    );
    return { number: String(highest + 1), name: '' };
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
      const floor = await inventoryApiService.createFloor(projectId, building.id, {
        number: Number(form.number),
        name: form.name || null,
      });
      addToast(`Floor ${floor.number} was added to building ${building.code}.`, 'success');
      onSaved?.(floor);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The floor could not be added.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={building ? `Add floor to ${building.code}` : 'Add floor'}
      description="Floors are optional labels above the building level. Units can reference them."
      size="small"
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
            form="floor-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Adding…' : 'Add floor'}
          </button>
        </>
      }
    >
      <form id="floor-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Floor number"
            id="floor-number"
            type="number"
            min="-10"
            max="200"
            step="1"
            value={form.number}
            onChange={updateField('number')}
            error={errors.number}
            required
          />
          <FormField
            label="Floor name"
            id="floor-name"
            value={form.name}
            onChange={updateField('name')}
            error={errors.name}
            hint="Optional, for example Roof terrace."
          />
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
