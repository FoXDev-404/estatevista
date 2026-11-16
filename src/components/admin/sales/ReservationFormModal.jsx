import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import { projectNameFor, todayInput } from '../../../services/salesSelectors';

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function ReservationFormModal({ customers = [], units = [], onClose, onSaved }) {
  const { addToast } = useToast();
  const today = todayInput();
  const [form, setForm] = useState({
    customer_id: '',
    unit_id: '',
    booking_amount: '',
    reserved_on: today,
    expires_at: addDays(today, 7),
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'unit_id' && value && !next.booking_amount) {
          const unit = units.find((row) => row.id === value);
          if (unit?.project?.booking_amount) next.booking_amount = unit.project.booking_amount;
        }
        return next;
      });
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
      const saved = await salesApiService.createReservation({
        customer_id: form.customer_id,
        unit_id: form.unit_id,
        booking_amount: form.booking_amount === '' ? 0 : form.booking_amount,
        reserved_on: form.reserved_on || null,
        expires_at: form.expires_at,
        notes: form.notes || null,
      });
      addToast(`Reservation ${saved.number} was created.`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The reservation could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Add reservation"
      description="Hold an available unit for a customer until the expiry date."
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
            form="reservation-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Add reservation'}
          </button>
        </>
      }
    >
      <form id="reservation-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Customer"
            id="reservation-customer"
            as="select"
            value={form.customer_id}
            onChange={updateField('customer_id')}
            error={errors.customer_id}
            required
          >
            <option value="">Choose a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Unit"
            id="reservation-unit"
            as="select"
            value={form.unit_id}
            onChange={updateField('unit_id')}
            error={errors.unit_id}
            required
            hint="Only available units are listed."
          >
            <option value="">Choose an available unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {projectNameFor(unit)} · {unit.unit_number}
              </option>
            ))}
          </FormField>
          <FormField
            label="Booking amount"
            id="reservation-booking"
            type="number"
            min="0"
            step="0.01"
            value={form.booking_amount}
            onChange={updateField('booking_amount')}
            error={errors.booking_amount}
          />
          <FormField
            label="Reserved on"
            id="reservation-date"
            type="date"
            value={form.reserved_on}
            onChange={updateField('reserved_on')}
            error={errors.reserved_on}
          />
          <FormField
            label="Expires on"
            id="reservation-expiry"
            type="date"
            value={form.expires_at}
            onChange={updateField('expires_at')}
            error={errors.expires_at}
            required
            hint="An expired reservation releases the unit automatically."
          />
          <FormField
            label="Notes"
            id="reservation-notes"
            as="textarea"
            rows="3"
            className="admin-form-grid__full"
            value={form.notes}
            onChange={updateField('notes')}
            error={errors.notes}
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
