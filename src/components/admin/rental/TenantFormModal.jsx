import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import rentalApiService from '../../../services/rentalApiService';
import { tenantTypeOptions } from '../../../services/rentalSelectors';

function initialForm(tenant) {
  return {
    name: tenant?.name || '',
    type: tenant?.type || 'individual',
    phone: tenant?.phone || '',
    alternate_phone: tenant?.alternate_phone || '',
    email: tenant?.email || '',
    national_id_type: tenant?.national_id_type || '',
    national_id_number: tenant?.national_id_number || '',
    date_of_birth: tenant?.date_of_birth || '',
    occupation: tenant?.occupation || '',
    address: tenant?.address || '',
    city: tenant?.city || '',
    country: tenant?.country || '',
    notes: tenant?.notes || '',
    is_active: tenant?.is_active ?? true,
  };
}

export default function TenantFormModal({ tenant = null, onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(tenant));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError('');
    try {
      const saved = tenant
        ? await rentalApiService.updateTenant(tenant.id, form)
        : await rentalApiService.createTenant(form);
      addToast(
        `${tenant ? 'Tenant updated' : 'Tenant added'}: ${saved.name}.`,
        'success',
      );
      onSaved(saved);
    } catch (submitError) {
      setErrors(submitError.fields || {});
      setError(submitError.message || 'The tenant could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={tenant ? 'Edit tenant' : 'Add tenant'}
      description="Contact and identification details for a rental tenant."
      size="large"
      footer={
        <>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="tenant-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : tenant ? 'Save tenant' : 'Add tenant'}
          </button>
        </>
      }
    >
      <form id="tenant-form" className="admin-modal-form" onSubmit={submit} noValidate>
        <div className="admin-form-grid">
          <FormField
            label="Name"
            id="tenant-name"
            required
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            error={errors.name}
          />
          <FormField
            label="Type"
            id="tenant-type"
            as="select"
            value={form.type}
            onChange={(event) => update('type', event.target.value)}
            error={errors.type}
          >
            {tenantTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Phone"
            id="tenant-phone"
            required
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            error={errors.phone}
          />
          <FormField
            label="Alternate phone"
            id="tenant-alternate-phone"
            value={form.alternate_phone}
            onChange={(event) => update('alternate_phone', event.target.value)}
            error={errors.alternate_phone}
          />
          <FormField
            label="Email"
            id="tenant-email"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            error={errors.email}
          />
          <FormField
            label="Occupation"
            id="tenant-occupation"
            value={form.occupation}
            onChange={(event) => update('occupation', event.target.value)}
            error={errors.occupation}
          />
          <FormField
            label="ID type"
            id="tenant-id-type"
            value={form.national_id_type}
            onChange={(event) => update('national_id_type', event.target.value)}
            error={errors.national_id_type}
          />
          <FormField
            label="ID number"
            id="tenant-id-number"
            value={form.national_id_number}
            onChange={(event) => update('national_id_number', event.target.value)}
            error={errors.national_id_number}
          />
          <FormField
            label="Date of birth"
            id="tenant-dob"
            type="date"
            value={form.date_of_birth || ''}
            onChange={(event) => update('date_of_birth', event.target.value)}
            error={errors.date_of_birth}
          />
          <FormField
            label="City"
            id="tenant-city"
            value={form.city}
            onChange={(event) => update('city', event.target.value)}
            error={errors.city}
          />
          <FormField
            label="Country"
            id="tenant-country"
            value={form.country}
            onChange={(event) => update('country', event.target.value)}
            error={errors.country}
          />
          <FormField
            label="Address"
            id="tenant-address"
            as="textarea"
            rows="2"
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
            error={errors.address}
            className="admin-form-grid__full"
          />
          <FormField
            label="Notes"
            id="tenant-notes"
            as="textarea"
            rows="3"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            error={errors.notes}
            className="admin-form-grid__full"
          />
        </div>

        <label className="form-field__checkbox-label" htmlFor="tenant-active">
          <input
            id="tenant-active"
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(event) => update('is_active', event.target.checked)}
          />
          <span>Active tenant</span>
        </label>

        {error ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
