import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import {
  formNetTotal,
  frequencyOptions,
  lateFeeOptions,
  projectNameFor,
  todayInput,
} from '../../../services/salesSelectors';
import { formatPrice } from '../../../services/formatters';

function dueDayOf(iso) {
  const day = Number(String(iso || todayInput()).slice(8, 10));
  return Math.min(Math.max(day || 1, 1), 28);
}

function initialForm(prefill) {
  const source = prefill?.record || null;
  const reservation = prefill?.source === 'reservation' ? source : null;
  const quotation = prefill?.source === 'quotation' ? source : null;
  const agreement = todayInput();
  return {
    customer_id: reservation?.customer_id || quotation?.customer_id || '',
    unit_id: reservation?.unit_id || quotation?.unit_id || '',
    salesperson_id: quotation?.salesperson_id || '',
    agreement_date: agreement,
    sale_price: quotation?.unit_price ?? '',
    discount_amount: quotation?.discount_amount ?? '',
    tax_amount: quotation?.tax_amount ?? '',
    payment_type: 'installments',
    notes: '',
    down_payment: '',
    number_of_installments: '3',
    frequency: 'monthly',
    start_date: agreement,
    due_day: String(dueDayOf(agreement)),
    grace_days: '5',
    late_fee_type: 'none',
    late_fee_value: '',
    reservation_id: reservation?.id || null,
    quotation_id: quotation?.id || null,
  };
}

export default function SaleFormModal({
  customers = [],
  units = [],
  users = [],
  prefill = null,
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(prefill));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const net = formNetTotal({
    price: form.sale_price,
    discount: form.discount_amount,
    tax: form.tax_amount,
  });
  const remaining = Math.max(0, net - Number(form.down_payment || 0));
  const count = Math.max(1, Number(form.number_of_installments) || 1);
  const perInstallment = remaining / count;

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'unit_id' && value) {
          const unit = units.find((row) => row.id === value);
          if (unit && !next.sale_price) next.sale_price = unit.sale_price ?? '';
        }
        if (field === 'agreement_date' && value && !current.start_date) {
          next.start_date = value;
          next.due_day = String(dueDayOf(value));
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
      const payload = {
        customer_id: form.customer_id,
        unit_id: form.unit_id,
        salesperson_id: form.salesperson_id || null,
        agreement_date: form.agreement_date || null,
        sale_price: form.sale_price === '' ? 0 : form.sale_price,
        discount_amount: form.discount_amount === '' ? 0 : form.discount_amount,
        tax_amount: form.tax_amount === '' ? 0 : form.tax_amount,
        payment_type: form.payment_type,
        notes: form.notes || null,
        plan:
          form.payment_type === 'installments'
            ? {
                down_payment: form.down_payment === '' ? 0 : form.down_payment,
                number_of_installments: Number(form.number_of_installments),
                frequency: form.frequency,
                start_date: form.start_date,
                due_day: Number(form.due_day),
                grace_days: Number(form.grace_days),
                late_fee_type: form.late_fee_type,
                late_fee_value: form.late_fee_value === '' ? 0 : form.late_fee_value,
              }
            : null,
        reservation_id: form.reservation_id,
        quotation_id: form.quotation_id,
      };
      const saved = await salesApiService.createSale(payload);
      addToast(`Sale ${saved.number} was created.`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The sale could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Add sale"
      description="Record a full-payment or installment sale. The unit is marked sold."
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
            form="sale-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Create sale'}
          </button>
        </>
      }
    >
      <form id="sale-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Customer"
            id="sale-customer"
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
            id="sale-unit"
            as="select"
            value={form.unit_id}
            onChange={updateField('unit_id')}
            error={errors.unit_id}
            required
          >
            <option value="">Choose an available or reserved unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {projectNameFor(unit)} · {unit.unit_number} ({unit.status})
              </option>
            ))}
          </FormField>
          <FormField
            label="Salesperson"
            id="sale-salesperson"
            as="select"
            value={form.salesperson_id}
            onChange={updateField('salesperson_id')}
            error={errors.salesperson_id}
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Agreement date"
            id="sale-agreement"
            type="date"
            value={form.agreement_date}
            onChange={updateField('agreement_date')}
            error={errors.agreement_date}
          />
          <FormField
            label={`Sale price (${currency})`}
            id="sale-price"
            type="number"
            min="0"
            step="0.01"
            value={form.sale_price}
            onChange={updateField('sale_price')}
            error={errors.sale_price}
            required
          />
          <FormField
            label={`Discount (${currency})`}
            id="sale-discount"
            type="number"
            min="0"
            step="0.01"
            value={form.discount_amount}
            onChange={updateField('discount_amount')}
            error={errors.discount_amount}
          />
          <FormField
            label={`Tax (${currency})`}
            id="sale-tax"
            type="number"
            min="0"
            step="0.01"
            value={form.tax_amount}
            onChange={updateField('tax_amount')}
            error={errors.tax_amount}
          />
          <FormField
            label="Payment type"
            id="sale-payment-type"
            as="select"
            value={form.payment_type}
            onChange={updateField('payment_type')}
            error={errors.payment_type}
          >
            <option value="installments">Installments</option>
            <option value="full">Full payment</option>
          </FormField>
        </div>

        <div className="sales-total-preview">
          <span>Net price</span>
          <strong>{formatPrice(net, currency)}</strong>
        </div>

        {form.payment_type === 'installments' ? (
          <fieldset className="admin-fieldset">
            <legend>Installment plan</legend>
            <div className="admin-form-grid admin-form-grid--two">
              <FormField
                label={`Down payment (${currency})`}
                id="sale-down-payment"
                type="number"
                min="0"
                step="0.01"
                value={form.down_payment}
                onChange={updateField('down_payment')}
                error={errors['plan.down_payment'] || errors.plan}
              />
              <FormField
                label="Number of installments"
                id="sale-count"
                type="number"
                min="1"
                max="240"
                step="1"
                value={form.number_of_installments}
                onChange={updateField('number_of_installments')}
                error={errors['plan.number_of_installments']}
              />
              <FormField
                label="Frequency"
                id="sale-frequency"
                as="select"
                value={form.frequency}
                onChange={updateField('frequency')}
                error={errors['plan.frequency']}
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Plan start"
                id="sale-start"
                type="date"
                value={form.start_date}
                onChange={updateField('start_date')}
                error={errors['plan.start_date']}
              />
              <FormField
                label="Due day"
                id="sale-due-day"
                type="number"
                min="1"
                max="28"
                step="1"
                value={form.due_day}
                onChange={updateField('due_day')}
                error={errors['plan.due_day']}
              />
              <FormField
                label="Grace days"
                id="sale-grace"
                type="number"
                min="0"
                max="90"
                step="1"
                value={form.grace_days}
                onChange={updateField('grace_days')}
                error={errors['plan.grace_days']}
              />
              <FormField
                label="Late fee"
                id="sale-late-fee"
                as="select"
                value={form.late_fee_type}
                onChange={updateField('late_fee_type')}
                error={errors['plan.late_fee_type']}
              >
                {lateFeeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
              <FormField
                label={`Late fee value (${currency})`}
                id="sale-late-fee-value"
                type="number"
                min="0"
                step="0.01"
                value={form.late_fee_value}
                onChange={updateField('late_fee_value')}
                error={errors['plan.late_fee_value']}
                disabled={form.late_fee_type === 'none'}
              />
            </div>
            <p className="admin-fieldset__note">
              Down payment is treated as collected today. The remaining{' '}
              {formatPrice(remaining, currency)} is split into {count} payment
              {count === 1 ? '' : 's'} of about {formatPrice(perInstallment, currency)}.
            </p>
          </fieldset>
        ) : (
          <p className="admin-modal-note">
            A full-payment sale creates one installment due on the agreement date.
            Record the receipt from Collections after saving.
          </p>
        )}

        <FormField
          label="Notes"
          id="sale-notes"
          as="textarea"
          rows="3"
          value={form.notes}
          onChange={updateField('notes')}
          error={errors.notes}
        />

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
