import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import rentalApiService from '../../../services/rentalApiService';
import {
  adjustmentTypeOptions,
  leaseFrequencyOptions,
  todayInput,
} from '../../../services/rentalSelectors';
import { formatPrice } from '../../../services/formatters';

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addYears(iso, years) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

const TITLES = {
  activate: 'Activate lease',
  renew: 'Renew lease',
  revise: 'Revise rent',
  terminate: 'Terminate lease',
  adjust: 'Adjust rent period',
};

export default function LeaseActionModal({
  lease,
  schedule = null,
  action,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState(
    lease?.end_date ? addDays(lease.end_date, 1) : todayInput(),
  );
  const [endDate, setEndDate] = useState(
    lease?.end_date ? addYears(addDays(lease.end_date, 1), 1) : addYears(todayInput(), 1),
  );
  const [rentAmount, setRentAmount] = useState(lease?.rent_amount || '');
  const [frequency, setFrequency] = useState(lease?.frequency || 'monthly');
  const [dueDay, setDueDay] = useState(lease?.due_day || 5);
  const [graceDays, setGraceDays] = useState(lease?.grace_days || 5);
  const [depositAmount, setDepositAmount] = useState(lease?.security_deposit_amount || '');
  const [effectiveDate, setEffectiveDate] = useState(todayInput());
  const [terminationDate, setTerminationDate] = useState(todayInput());
  const [reason, setReason] = useState('');
  const [adjustType, setAdjustType] = useState('extra_charge');
  const [adjustAmount, setAdjustAmount] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setErrors({});
    try {
      if (action === 'activate') {
        await rentalApiService.activateLease(lease.id);
        addToast(`Lease ${lease.number} activated.`, 'success');
      } else if (action === 'renew') {
        const renewed = await rentalApiService.renewLease(lease.id, {
          start_date: startDate,
          end_date: endDate,
          frequency,
          rent_amount: Number(rentAmount || 0),
          due_day: Number(dueDay || 1),
          grace_days: Number(graceDays || 0),
          late_fee_type: 'none',
          late_fee_value: 0,
          notice_period_days: lease.notice_period_days || 30,
          security_deposit_amount: Number(depositAmount || 0),
          utilities_included: lease.utilities_included || [],
          terms: lease.terms || null,
          activate: true,
        });
        addToast(`Lease ${renewed.number} created from ${lease.number}.`, 'success');
      } else if (action === 'revise') {
        await rentalApiService.reviseLeaseRent(lease.id, {
          rent_amount: Number(rentAmount || 0),
          effective_date: effectiveDate,
          reason: reason || null,
        });
        addToast(`Rent for ${lease.number} updated.`, 'success');
      } else if (action === 'terminate') {
        await rentalApiService.terminateLease(lease.id, {
          termination_date: terminationDate,
          reason,
        });
        addToast(`Lease ${lease.number} terminated.`, 'success');
      } else {
        await rentalApiService.adjustRentSchedule(lease.id, schedule.id, {
          type: adjustType,
          amount: adjustType === 'waiver' ? undefined : Number(adjustAmount || 0),
          reason: reason || null,
        });
        addToast(`${schedule.period_label} updated.`, 'success');
      }
      onSaved();
    } catch (submitError) {
      setErrors(submitError.fields || {});
      setError(submitError.message || 'The lease action could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
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
        form="lease-action-form"
        className={`button ${action === 'terminate' ? 'button--danger' : 'button--primary'} button--md`}
        disabled={saving}
      >
        {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
        {saving ? 'Saving…' : TITLES[action]}
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={TITLES[action]}
      description={
        action === 'activate'
          ? `Generate the rent schedule for ${lease.number} and mark the unit rented.`
          : action === 'renew'
            ? `Create a follow-on lease for ${lease.tenant?.name || 'the tenant'} and keep the unit rented.`
            : action === 'revise'
              ? 'Only future, unpaid rent periods change. Collected periods stay on record.'
              : action === 'terminate'
                ? 'Future unpaid rent periods are cancelled and the unit is released.'
                : `Adjust ${schedule?.period_label || 'this rent period'} for ${lease.number}.`
      }
      size="small"
      footer={footer}
    >
      <form id="lease-action-form" className="admin-modal-form" onSubmit={submit} noValidate>
        {action === 'activate' ? (
          <>
            <div className="admin-detail-grid">
              <div>
                <span>Rent</span>
                <strong>{formatPrice(lease.rent_amount || 0, currency)}</strong>
              </div>
              <div>
                <span>Period</span>
                <strong>
                  {lease.start_date} → {lease.end_date}
                </strong>
              </div>
            </div>
            <p className="admin-modal-note">
              {lease.schedules?.length
                ? 'This lease already has a schedule and cannot be activated again.'
                : 'The schedule is anchored to the start date and the due day.'}
            </p>
          </>
        ) : null}

        {action === 'renew' ? (
          <div className="admin-form-grid">
            <FormField
              label="Start date"
              id="renew-start"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              error={errors.start_date}
            />
            <FormField
              label="End date"
              id="renew-end"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              error={errors.end_date}
            />
            <FormField
              label="Rent"
              id="renew-rent"
              type="number"
              min="0"
              step="0.01"
              required
              value={rentAmount}
              onChange={(event) => setRentAmount(event.target.value)}
              error={errors.rent_amount}
            />
            <FormField
              label="Frequency"
              id="renew-frequency"
              as="select"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
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
              id="renew-due-day"
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
              error={errors.due_day}
            />
            <FormField
              label="Grace days"
              id="renew-grace"
              type="number"
              min="0"
              max="60"
              value={graceDays}
              onChange={(event) => setGraceDays(event.target.value)}
              error={errors.grace_days}
            />
            <FormField
              label="Security deposit"
              id="renew-deposit"
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              error={errors.security_deposit_amount}
            />
          </div>
        ) : null}

        {action === 'revise' ? (
          <div className="admin-form-grid">
            <FormField
              label="New rent"
              id="revise-rent"
              type="number"
              min="0"
              step="0.01"
              required
              value={rentAmount}
              onChange={(event) => setRentAmount(event.target.value)}
              error={errors.rent_amount}
            />
            <FormField
              label="Effective from"
              id="revise-effective"
              type="date"
              required
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              error={errors.effective_date}
            />
            <FormField
              label="Reason"
              id="revise-reason"
              as="textarea"
              rows="2"
              className="admin-form-grid__full"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={errors.reason}
            />
          </div>
        ) : null}

        {action === 'terminate' ? (
          <div className="admin-form-grid">
            <FormField
              label="Termination date"
              id="terminate-date"
              type="date"
              required
              value={terminationDate}
              onChange={(event) => setTerminationDate(event.target.value)}
              error={errors.termination_date}
            />
            <FormField
              label="Reason"
              id="terminate-reason"
              as="textarea"
              rows="3"
              className="admin-form-grid__full"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={errors.reason}
            />
          </div>
        ) : null}

        {action === 'adjust' ? (
          <div className="admin-form-grid">
            <FormField
              label="Adjustment"
              id="adjust-type"
              as="select"
              value={adjustType}
              onChange={(event) => setAdjustType(event.target.value)}
              error={errors.type}
            >
              {adjustmentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FormField>
            {adjustType !== 'waiver' ? (
              <FormField
                label="Amount"
                id="adjust-amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={adjustAmount}
                onChange={(event) => setAdjustAmount(event.target.value)}
                error={errors.amount}
              />
            ) : null}
            <FormField
              label="Reason"
              id="adjust-reason"
              as="textarea"
              rows="2"
              className="admin-form-grid__full"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={errors.reason}
            />
            <p className="admin-modal-note admin-form-grid__full">
              Current balance: {formatPrice(schedule?.balance || 0, currency)}.
              {adjustType === 'waiver'
                ? ' Waiving closes this period permanently.'
                : ' Extra charges add to the balance; discounts reduce it.'}
            </p>
          </div>
        ) : null}

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
