import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import crmApiService from '../../../services/crmApiService';
import { customerTypeOptions } from '../../../services/crmSelectors';

const EMPTY_FORM = {
  name: '',
  type: 'individual',
  phone: '',
  alternate_phone: '',
  email: '',
  national_id: '',
  date_of_birth: '',
  occupation: '',
  address: '',
  city: '',
  country: '',
  source_id: '',
  is_active: true,
};

function initialForm(customer) {
  if (!customer) return EMPTY_FORM;
  return {
    name: customer.name || '',
    type: customer.type || 'individual',
    phone: customer.phone || '',
    alternate_phone: customer.alternate_phone || '',
    email: customer.email || '',
    national_id: customer.national_id || '',
    date_of_birth: customer.date_of_birth || '',
    occupation: customer.occupation || '',
    address: customer.address || '',
    city: customer.city || '',
    country: customer.country || '',
    source_id: customer.source_id || '',
    is_active: customer.is_active !== false,
  };
}

export default function CustomerFormModal({
  customer = null,
  sources = [],
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(customer));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(customer);

  function updateField(field) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
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
      const payload = { ...form, source_id: form.source_id || null };
      const saved = editing
        ? await crmApiService.updateCustomer(customer.id, payload)
        : await crmApiService.createCustomer(payload);
      addToast(editing ? 'Customer updated.' : `Customer ${saved.name} was added.`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The customer could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit ${customer.name}` : 'New customer'}
      description="Customer records hold the contact and identity details used by reservations, sales and leases."
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
            form="customer-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save customer' : 'Add customer'}
          </button>
        </>
      }
    >
      <form id="customer-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Full name"
            id="customer-name"
            value={form.name}
            onChange={updateField('name')}
            error={errors.name}
            required
          />
          <FormField
            label="Type"
            id="customer-type"
            as="select"
            value={form.type}
            onChange={updateField('type')}
            error={errors.type}
            required
          >
            {customerTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Phone"
            id="customer-phone"
            type="tel"
            value={form.phone}
            onChange={updateField('phone')}
            error={errors.phone}
            required
          />
          <FormField
            label="Alternate phone"
            id="customer-alt-phone"
            type="tel"
            value={form.alternate_phone}
            onChange={updateField('alternate_phone')}
            error={errors.alternate_phone}
          />
          <FormField
            label="Email"
            id="customer-email"
            type="email"
            value={form.email}
            onChange={updateField('email')}
            error={errors.email}
          />
          <FormField
            label="Source"
            id="customer-source"
            as="select"
            value={form.source_id}
            onChange={updateField('source_id')}
            error={errors.source_id}
          >
            <option value="">No source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="National ID"
            id="customer-national-id"
            value={form.national_id}
            onChange={updateField('national_id')}
            error={errors.national_id}
          />
          <FormField
            label="Date of birth"
            id="customer-dob"
            type="date"
            value={form.date_of_birth}
            onChange={updateField('date_of_birth')}
            error={errors.date_of_birth}
          />
          <FormField
            label="Occupation"
            id="customer-occupation"
            value={form.occupation}
            onChange={updateField('occupation')}
            error={errors.occupation}
          />
          <FormField
            label="City"
            id="customer-city"
            value={form.city}
            onChange={updateField('city')}
            error={errors.city}
          />
          <FormField
            label="Country"
            id="customer-country"
            value={form.country}
            onChange={updateField('country')}
            error={errors.country}
          />
          <FormField
            label="Address"
            id="customer-address"
            className="admin-form-grid__full"
            value={form.address}
            onChange={updateField('address')}
            error={errors.address}
          />
          {editing ? (
            <FormField
              label="Active customer"
              id="customer-active"
              type="checkbox"
              className="admin-form-grid__full"
              checked={form.is_active}
              onChange={updateField('is_active')}
              error={errors.is_active}
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
