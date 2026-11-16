import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import { formatDate, formatPrice } from '../../../services/formatters';

export default function InstallmentActionModal({
  saleId,
  installment,
  action,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const rescheduling = action === 'reschedule';
  const [dueDate, setDueDate] = useState(installment?.due_date || '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = rescheduling
        ? await salesApiService.rescheduleInstallment(saleId, installment.id, dueDate)
        : await salesApiService.waiveInstallment(saleId, installment.id, reason || '');
      addToast(
        rescheduling
          ? `Installment ${installment.sequence} moved to ${formatDate(updated.due_date)}.`
          : `Installment ${installment.sequence} was waived.`,
        'success',
      );
      onSaved?.(updated);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The installment could not be updated.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={rescheduling ? 'Reschedule installment' : 'Waive installment'}
      description={
        installment
          ? `Installment ${installment.sequence} · ${formatPrice(
              installment.amount,
              currency,
            )} due ${formatDate(installment.due_date)}.`
          : ''
      }
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
            form="installment-action-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : rescheduling ? 'Reschedule' : 'Waive installment'}
          </button>
        </>
      }
    >
      <form
        id="installment-action-form"
        className="admin-modal-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {rescheduling ? (
          <FormField
            label="New due date"
            id="installment-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            error={errors.due_date}
            required
          />
        ) : (
          <>
            <div className="admin-alert admin-alert--danger" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <p>
                Waiving clears the remaining balance of {formatPrice(installment?.balance, currency)}.
                The installment stays in the schedule for the audit trail.
              </p>
            </div>
            <FormField
              label="Reason"
              id="installment-waive-reason"
              as="textarea"
              rows="3"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={errors.reason}
            />
          </>
        )}

        {errors.status ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{errors.status}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
