import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import rentalApiService from '../../../services/rentalApiService';
import { depositHeldAmount } from '../../../services/rentalSelectors';
import { formatPrice } from '../../../services/formatters';

const LABELS = {
  receipt: {
    title: 'Receive security deposit',
    action: 'Receive deposit',
    hint: 'Amount received from the tenant.',
  },
  deduction: {
    title: 'Deduct from deposit',
    action: 'Record deduction',
    hint: 'Damage, repairs or unpaid charges covered by the deposit.',
  },
  refund: {
    title: 'Refund security deposit',
    action: 'Refund deposit',
    hint: 'Amount returned to the tenant after settlement.',
  },
};

export default function DepositActionModal({
  deposit,
  action,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const labels = LABELS[action];
  const held = depositHeldAmount(deposit);
  const suggested =
    action === 'receipt'
      ? Math.max(0, Number(deposit.required_amount || 0) - Number(deposit.received_amount || 0))
      : held;

  const [amount, setAmount] = useState(String(suggested || ''));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setErrors({});
    try {
      const values = { amount: Number(amount || 0), reason: reason || null };
      if (action === 'receipt') await rentalApiService.receiveDeposit(deposit.id, values);
      else if (action === 'deduction') await rentalApiService.deductDeposit(deposit.id, values);
      else await rentalApiService.refundDeposit(deposit.id, values);
      addToast(`${labels.title} saved for ${deposit.lease?.number || 'the lease'}.`, 'success');
      onSaved();
    } catch (submitError) {
      setErrors(submitError.fields || {});
      setError(submitError.message || 'The deposit could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title={labels.title}
      description={`${deposit.lease?.number || 'Lease'} · ${deposit.tenant?.name || 'Tenant'}`}
      size="small"
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
            form="deposit-action-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : labels.action}
          </button>
        </>
      }
    >
      <form id="deposit-action-form" className="admin-modal-form" onSubmit={submit} noValidate>
        <div className="admin-detail-grid">
          <div>
            <span>Required</span>
            <strong>{formatPrice(deposit.required_amount || 0, currency)}</strong>
          </div>
          <div>
            <span>Received</span>
            <strong>{formatPrice(deposit.received_amount || 0, currency)}</strong>
          </div>
          <div>
            <span>Held</span>
            <strong>{formatPrice(held, currency)}</strong>
          </div>
        </div>

        <FormField
          label="Amount"
          id="deposit-amount"
          type="number"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors.amount}
          hint={labels.hint}
        />
        <FormField
          label="Reason"
          id="deposit-reason"
          as="textarea"
          rows="3"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={errors.reason}
        />

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
