import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, LoaderCircle, Wand2 } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import {
  allocationTotal,
  autoAllocate,
  moneyRound,
  openInstallments,
  todayInput,
} from '../../../services/salesSelectors';
import { formatDate, formatPrice } from '../../../services/formatters';

function allocationRows(pool, allocations) {
  return pool
    .map((installment) => ({
      installment,
      amount: allocations[installment.id] === '' ? null : Number(allocations[installment.id]),
    }))
    .filter((row) => Number(row.amount || 0) > 0);
}

export default function ReceivePaymentModal({
  customerId = '',
  customers = [],
  installments: presetInstallments = null,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const lockedCustomer = Boolean(customerId);
  const [form, setForm] = useState({
    customer_id: customerId,
    received_on: todayInput(),
    amount: '',
    reference: '',
    notes: '',
  });
  const [pool, setPool] = useState(() =>
    presetInstallments ? openInstallments(presetInstallments) : [],
  );
  const [allocations, setAllocations] = useState({});
  const [loadedCustomer, setLoadedCustomer] = useState(
    presetInstallments ? customerId : '',
  );
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const loading =
    Boolean(form.customer_id) &&
    !presetInstallments &&
    !loadError &&
    loadedCustomer !== form.customer_id;

  useEffect(() => {
    if (presetInstallments) return undefined;
    const customerId = form.customer_id;
    if (!customerId) return undefined;

    let ignore = false;
    salesApiService
      .listInstallments({ status: 'open', limit: 100 })
      .then((result) => {
        if (ignore) return;
        const rows = openInstallments(
          result.data.filter((row) => row.sale?.customer_id === customerId),
        );
        setPool(rows);
        setAllocations({});
        setLoadError('');
        setLoadedCustomer(customerId);
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Installments could not be loaded.');
        setLoadedCustomer(customerId);
      });

    return () => {
      ignore = true;
    };
  }, [form.customer_id, presetInstallments]);

  const rows = useMemo(() => allocationRows(pool, allocations), [pool, allocations]);
  const total = allocationTotal(rows);
  const amount = moneyRound(Number(form.amount || 0));
  const difference = moneyRound(amount - total);
  const poolBalance = moneyRound(
    pool.reduce((sum, installment) => sum + Number(installment.balance || 0), 0),
  );
  const exceedsPool = amount > poolBalance + 0.005;
  const canSubmit =
    Boolean(form.customer_id) &&
    amount > 0 &&
    rows.length > 0 &&
    Math.abs(difference) <= 0.005 &&
    !saving;

  const selectedCustomer = customers.find((customer) => customer.id === form.customer_id);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function updateCustomer(event) {
    const value = event.target.value;
    setForm((current) => ({ ...current, customer_id: value }));
    setPool([]);
    setAllocations({});
    setLoadError('');
    setErrors((current) => ({ ...current, customer_id: undefined }));
  }

  function updateAllocation(installmentId, value) {
    setAllocations((current) => ({ ...current, [installmentId]: value }));
    setErrors((current) => ({ ...current, allocations: undefined }));
  }

  function handleAutoAllocate() {
    if (amount <= 0) {
      addToast('Enter the receipt amount first.', 'error');
      return;
    }
    const result = autoAllocate(pool, amount);
    const next = {};
    result.rows.forEach((row) => {
      next[row.installment.id] = String(row.amount);
    });
    setAllocations(next);
    if (result.remaining > 0) {
      addToast(
        `Only ${formatPrice(poolBalance, currency)} is open. Reduce the receipt by ${formatPrice(
          result.remaining,
          currency,
        )}.`,
        'error',
      );
    }
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});

    if (!form.customer_id) {
      setErrors({ customer_id: 'Choose a customer.' });
      return;
    }
    if (amount <= 0) {
      setErrors({ amount: 'Enter a receipt amount greater than zero.' });
      return;
    }
    if (!rows.length) {
      setErrors({ allocations: 'Allocate the receipt to at least one installment.' });
      return;
    }
    const overAllocated = rows.find(
      (row) => row.amount > Number(row.installment.balance || 0) + 0.005,
    );
    if (overAllocated) {
      setErrors({
        allocations: `The allocation for installment ${overAllocated.installment.sequence} exceeds its balance.`,
      });
      return;
    }
    if (Math.abs(difference) > 0.005) {
      setErrors({
        allocations:
          difference > 0
            ? `Allocate ${formatPrice(difference, currency)} more.`
            : `Allocations exceed the receipt by ${formatPrice(-difference, currency)}.`,
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await salesApiService.createCollection({
        customer_id: form.customer_id,
        received_on: form.received_on || null,
        amount,
        reference: form.reference || null,
        notes: form.notes || null,
        allocations: rows.map((row) => ({
          installment_id: row.installment.id,
          amount: row.amount,
        })),
      });
      addToast(`Receipt ${saved.number} was recorded.`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The receipt could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Receive payment"
      description="Record money received and allocate it against open installments."
      size="large"
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
            form="receive-payment-form"
            className="button button--primary button--md"
            disabled={!canSubmit}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Record receipt'}
          </button>
        </>
      }
    >
      <form id="receive-payment-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Customer"
            id="receipt-customer"
            as="select"
            value={form.customer_id}
            onChange={updateCustomer}
            error={errors.customer_id}
            disabled={lockedCustomer}
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
            label="Received on"
            id="receipt-date"
            type="date"
            value={form.received_on}
            onChange={updateField('received_on')}
            error={errors.received_on}
          />
          <FormField
            label={`Amount received (${currency})`}
            id="receipt-amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={updateField('amount')}
            error={errors.amount}
            required
          />
          <FormField
            label="Reference"
            id="receipt-reference"
            value={form.reference}
            onChange={updateField('reference')}
            error={errors.reference}
            hint="Cheque number, transfer reference or receipt book entry."
          />
        </div>

        <div className="sales-allocation">
          <div className="sales-allocation__head">
            <div>
              <h3>Allocate to installments</h3>
              <p>
                {lockedCustomer
                  ? `Open balance ${formatPrice(poolBalance, currency)} for this sale.`
                  : 'Choose a customer to load their open installments.'}
              </p>
            </div>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={handleAutoAllocate}
              disabled={!pool.length || amount <= 0 || loading}
            >
              <Wand2 size={14} aria-hidden="true" />
              Auto-allocate
            </button>
          </div>

          {loading ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={18} className="spin" aria-hidden="true" />
              Loading open installments…
            </div>
          ) : null}

          {!loading && loadError ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <p>{loadError}</p>
            </div>
          ) : null}

          {!loading && !loadError && form.customer_id && !pool.length ? (
            <p className="admin-modal-note">
              {selectedCustomer?.name || 'This customer'} has no open installments.
            </p>
          ) : null}

          {!loading && !loadError && !form.customer_id ? (
            <p className="admin-modal-note">Pick a customer above to see what can be collected.</p>
          ) : null}

          {!loading && pool.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table sales-allocation__table">
                  <thead>
                    <tr>
                      <th scope="col">Installment</th>
                      <th scope="col">Due date</th>
                      <th scope="col">Sale</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Allocate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pool.map((installment) => (
                      <tr key={installment.id}>
                        <th scope="row">#{installment.sequence}</th>
                        <td>{formatDate(installment.due_date)}</td>
                        <td>{installment.sale?.number || '—'}</td>
                        <td>{formatPrice(installment.balance, currency)}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={installment.balance}
                            step="0.01"
                            className="sales-allocation__input"
                            value={allocations[installment.id] ?? ''}
                            onChange={(event) =>
                              updateAllocation(installment.id, event.target.value)
                            }
                            aria-label={`Allocate to installment ${installment.sequence}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sales-allocation__totals">
                <span>
                  Allocated <strong>{formatPrice(total, currency)}</strong>
                </span>
                <span>
                  Receipt <strong>{formatPrice(amount, currency)}</strong>
                </span>
                <span className={Math.abs(difference) <= 0.005 ? 'is-balanced' : ''}>
                  {Math.abs(difference) <= 0.005
                    ? 'Balanced'
                    : difference > 0
                      ? `${formatPrice(difference, currency)} left`
                      : `${formatPrice(-difference, currency)} over`}
                </span>
              </div>
              {exceedsPool ? (
                <p className="sales-allocation__warning">
                  The receipt is more than the total open balance of{' '}
                  {formatPrice(poolBalance, currency)}.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <FormField
          label="Notes"
          id="receipt-notes"
          as="textarea"
          rows="3"
          value={form.notes}
          onChange={updateField('notes')}
          error={errors.notes}
        />

        {errors.allocations ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{errors.allocations}</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
