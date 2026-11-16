import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import rentalApiService from '../../../services/rentalApiService';
import {
  leaseFrequencyOptions,
  todayInput,
  utilityOptions,
} from '../../../services/rentalSelectors';
import { projectNameFor } from '../../../services/salesSelectors';

function addYears(iso, years) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function initialForm() {
  const start = todayInput();
  return {
    unit_id: '',
    tenant_id: '',
    start_date: start,
    end_date: addYears(start, 1),
    frequency: 'monthly',
    rent_amount: '',
    due_day: 5,
    grace_days: 5,
    late_fee_type: 'none',
    late_fee_value: 0,
    notice_period_days: 30,
    security_deposit_amount: '',
    utilities_included: [],
    terms: '',
    activate: true,
  };
}

export default function LeaseFormModal({ tenants = [], units = [], onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleUtility(value) {
    setForm((current) => ({
      ...current,
      utilities_included: current.utilities_included.includes(value)
        ? current.utilities_included.filter((item) => item !== value)
        : [...current.utilities_included, value],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError('');
    try {
      const lease = await rentalApiService.createLease({
        ...form,
        rent_amount: Number(form.rent_amount || 0),
        security_deposit_amount: Number(form.security_deposit_amount || 0),
        late_fee_value: Number(form.late_fee_value || 0),
        due_day: Number(form.due_day || 1),
        grace_days: Number(form.grace_days || 0),
        notice_period_days: Number(form.notice_period_days || 0),
      });
      addToast(
        `Lease ${lease.number} ${lease.status === 'active' ? 'activated' : 'saved as draft'}.`,
        'success',
      );
      onSaved(lease);
    } catch (submitError) {
      setErrors(submitError.fields || {});
      setError(submitError.message || 'The lease could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="New lease"
      description="Create a rental agreement and optionally activate it to generate the rent schedule."
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
            form="lease-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Create lease'}
          </button>
        </>
      }
    >
      <form id="lease-form" className="admin-modal-form" onSubmit={submit} noValidate>
        <div className="admin-form-grid">
          <FormField
            label="Tenant"
            id="lease-tenant"
            as="select"
            required
            value={form.tenant_id}
            onChange={(event) => update('tenant_id', event.target.value)}
            error={errors.tenant_id}
          >
            <option value="">Choose a tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
                {tenant.phone ? ` · ${tenant.phone}` : ''}
              </option>
            ))}
          </FormField>
          <FormField
            label="Unit"
            id="lease-unit"
            as="select"
            required
            value={form.unit_id}
            onChange={(event) => update('unit_id', event.target.value)}
            error={errors.unit_id}
          >
            <option value="">Choose a unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_number} · {projectNameFor(unit)}
              </option>
            ))}
          </FormField>
          <FormField
            label="Start date"
            id="lease-start"
            type="date"
            required
            value={form.start_date}
            onChange={(event) => update('start_date', event.target.value)}
            error={errors.start_date}
          />
          <FormField
            label="End date"
            id="lease-end"
            type="date"
            required
            value={form.end_date}
            onChange={(event) => update('end_date', event.target.value)}
            error={errors.end_date}
          />
          <FormField
            label="Rent"
            id="lease-rent"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.rent_amount}
            onChange={(event) => update('rent_amount', event.target.value)}
            error={errors.rent_amount}
          />
          <FormField
            label="Frequency"
            id="lease-frequency"
            as="select"
            value={form.frequency}
            onChange={(event) => update('frequency', event.target.value)}
            error={errors.frequency}
          >
            {leaseFrequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Due day"
            id="lease-due-day"
            type="number"
            min="1"
            max="28"
            value={form.due_day}
            onChange={(event) => update('due_day', event.target.value)}
            error={errors.due_day}
          />
          <FormField
            label="Grace days"
            id="lease-grace"
            type="number"
            min="0"
            max="60"
            value={form.grace_days}
            onChange={(event) => update('grace_days', event.target.value)}
            error={errors.grace_days}
          />
          <FormField
            label="Late fee"
            id="lease-late-fee-type"
            as="select"
            value={form.late_fee_type}
            onChange={(event) => update('late_fee_type', event.target.value)}
            error={errors.late_fee_type}
          >
            <option value="none">No late fee</option>
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </FormField>
          <FormField
            label="Late fee value"
            id="lease-late-fee-value"
            type="number"
            min="0"
            step="0.01"
            value={form.late_fee_value}
            onChange={(event) => update('late_fee_value', event.target.value)}
            error={errors.late_fee_value}
            disabled={form.late_fee_type === 'none'}
          />
          <FormField
            label="Notice period (days)"
            id="lease-notice"
            type="number"
            min="0"
            max="365"
            value={form.notice_period_days}
            onChange={(event) => update('notice_period_days', event.target.value)}
            error={errors.notice_period_days}
          />
          <FormField
            label="Security deposit"
            id="lease-deposit"
            type="number"
            min="0"
            step="0.01"
            value={form.security_deposit_amount}
            onChange={(event) => update('security_deposit_amount', event.target.value)}
            error={errors.security_deposit_amount}
          />
          <FormField
            label="Terms"
            id="lease-terms"
            as="textarea"
            rows="3"
            className="admin-form-grid__full"
            value={form.terms}
            onChange={(event) => update('terms', event.target.value)}
            error={errors.terms}
          />
        </div>

        <fieldset className="admin-fieldset">
          <legend>Utilities included</legend>
          <div className="admin-form-grid admin-form-grid--two">
            {utilityOptions.map((option) => (
              <label key={option.value} className="form-field__checkbox-label">
                <input
                  type="checkbox"
                  checked={form.utilities_included.includes(option.value)}
                  onChange={() => toggleUtility(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="form-field__checkbox-label" htmlFor="lease-activate">
          <input
            id="lease-activate"
            type="checkbox"
            checked={form.activate}
            onChange={(event) => update('activate', event.target.checked)}
          />
          <span>Activate now and generate the rent schedule</span>
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
