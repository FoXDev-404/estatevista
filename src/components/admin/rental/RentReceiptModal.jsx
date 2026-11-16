import { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import rentalApiService from '../../../services/rentalApiService';
import {
  allocationTotal,
  todayInput,
} from '../../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../../services/formatters';

export default function RentReceiptModal({
  leaseId,
  tenantId,
  tenantName,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    received_on: todayInput(),
    amount: '',
    reference: '',
    notes: '',
  });
  const [allocations, setAllocations] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    rentalApiService
      .listRentRoll({ lease_id: leaseId, status: 'open', limit: 200 })
      .then((result) => {
        if (ignore) return;
        setSchedules(result.data);
        setStatus('ready');
      })
      .catch((loadFailure) => {
        if (ignore) return;
        setLoadError(loadFailure.message || 'Open rent periods could not be loaded.');
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, [leaseId]);

  function changeAmount(value) {
    setForm((current) => ({ ...current, amount: value }));
    let remaining = Math.max(0, Number(value || 0));
    const next = {};
    for (const schedule of schedules) {
      if (remaining <= 0) break;
      const balance = Number(schedule.balance || 0);
      const allocated = Math.round((Math.min(balance, remaining) + Number.EPSILON) * 100) / 100;
      next[schedule.id] = String(allocated);
      remaining = Math.round((remaining - allocated) * 100) / 100;
    }
    setAllocations(next);
  }

  function changeAllocation(scheduleId, value) {
    setAllocations((current) => ({ ...current, [scheduleId]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setError('');
    const rows = schedules
      .map((schedule) => ({
        rent_schedule_id: schedule.id,
        amount: Number(allocations[schedule.id] || 0),
      }))
      .filter((row) => row.amount > 0);

    if (Number(form.amount || 0) <= 0) {
      setErrors({ amount: 'Enter a receipt amount greater than zero.' });
      setSaving(false);
      return;
    }
    if (Math.abs(allocationTotal(rows) - Number(form.amount || 0)) > 0.005) {
      setErrors({ allocations: 'Allocations must equal the receipt amount.' });
      setSaving(false);
      return;
    }

    try {
      const receipt = await rentalApiService.createRentCollection({
        tenant_id: tenantId,
        received_on: form.received_on || todayInput(),
        amount: Number(form.amount || 0),
        reference: form.reference || null,
        notes: form.notes || null,
        allocations: rows,
      });
      addToast(`Rent receipt ${receipt.number} recorded.`, 'success');
      onSaved(receipt);
    } catch (submitError) {
      setErrors(submitError.fields || {});
      setError(submitError.message || 'The rent receipt could not be recorded.');
    } finally {
      setSaving(false);
    }
  }

  const allocated = allocationTotal(
    schedules.map((schedule) => ({ amount: Number(allocations[schedule.id] || 0) })),
  );
  const remaining = Math.round(
    (Number(form.amount || 0) - allocated + Number.EPSILON) * 100,
  ) / 100;

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="Record rent receipt"
      description={`Collect rent from ${tenantName || 'the tenant'} and allocate it to open periods.`}
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
            form="rent-receipt-form"
            className="button button--primary button--md"
            disabled={saving || status !== 'ready'}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Record receipt'}
          </button>
        </>
      }
    >
      {status === 'loading' ? (
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading open rent periods…
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <p>{loadError}</p>
        </div>
      ) : null}

      {status === 'ready' ? (
        <form id="rent-receipt-form" className="admin-modal-form" onSubmit={submit} noValidate>
          <div className="admin-form-grid">
            <FormField
              label="Received on"
              id="rent-received-on"
              type="date"
              value={form.received_on}
              onChange={(event) =>
                setForm((current) => ({ ...current, received_on: event.target.value }))
              }
              error={errors.received_on}
            />
            <FormField
              label="Amount"
              id="rent-amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) => changeAmount(event.target.value)}
              error={errors.amount}
            />
            <FormField
              label="Reference"
              id="rent-reference"
              value={form.reference}
              onChange={(event) =>
                setForm((current) => ({ ...current, reference: event.target.value }))
              }
              error={errors.reference}
              hint="Cheque, transfer or receipt reference."
            />
            <FormField
              label="Notes"
              id="rent-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              error={errors.notes}
            />
          </div>

          {!schedules.length ? (
            <p className="admin-modal-note">This lease has no open rent periods.</p>
          ) : (
            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Due</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id}>
                      <th scope="row">{schedule.period_label}</th>
                      <td>{formatDate(schedule.due_date)}</td>
                      <td>{formatPrice(schedule.balance || 0, currency)}</td>
                      <td>
                        <input
                          className="admin-inline-input"
                          type="number"
                          min="0"
                          max={schedule.balance}
                          step="0.01"
                          value={allocations[schedule.id] || ''}
                          onChange={(event) =>
                            changeAllocation(schedule.id, event.target.value)
                          }
                          aria-label={`Allocation for ${schedule.period_label}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sales-allocation__totals">
            <span>
              Receipt <strong>{formatPrice(Number(form.amount || 0), currency)}</strong>
            </span>
            <span>
              Allocated <strong>{formatPrice(allocated, currency)}</strong>
            </span>
            <span className={remaining === 0 ? 'is-balanced' : undefined}>
              {remaining === 0
                ? 'Fully allocated'
                : `${formatPrice(Math.abs(remaining), currency)} ${remaining > 0 ? 'left' : 'over'}`}
            </span>
          </div>

          {errors.allocations ? (
            <p className="form-field__error" role="alert">
              {errors.allocations}
            </p>
          ) : null}

          {error ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : null}
        </form>
      ) : null}
    </Modal>
  );
}
