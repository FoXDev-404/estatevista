import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import {
  formNetTotal,
  projectNameFor,
  quotationStatusOptions,
  todayInput,
} from '../../../services/salesSelectors';
import { formatPrice } from '../../../services/formatters';

function initialForm(quotation, initialLead, units) {
  if (quotation) {
    return {
      customer_id: quotation.customer_id || '',
      lead_id: quotation.lead_id || '',
      unit_id: quotation.unit_id || '',
      salesperson_id: quotation.salesperson_id || '',
      quotation_date: quotation.quotation_date || todayInput(),
      valid_until: quotation.valid_until || '',
      unit_price: quotation.unit_price ?? '',
      discount_amount: quotation.discount_amount ?? '',
      tax_amount: quotation.tax_amount ?? '',
      terms: quotation.terms || '',
      status: ['draft', 'sent'].includes(quotation.status) ? quotation.status : 'draft',
    };
  }

  const leadUnit = initialLead?.unit_id
    ? units.find((unit) => unit.id === initialLead.unit_id)
    : null;
  const price = initialLead?.budget_max || leadUnit?.sale_price || '';

  return {
    customer_id: '',
    lead_id: initialLead?.id || '',
    unit_id: initialLead?.unit_id || '',
    salesperson_id: initialLead?.assigned_to || '',
    quotation_date: todayInput(),
    valid_until: '',
    unit_price: price,
    discount_amount: '',
    tax_amount: '',
    terms: '',
    status: 'draft',
  };
}

export default function QuotationFormModal({
  quotation = null,
  initialLead = null,
  customers = [],
  leads = [],
  units = [],
  users = [],
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(quotation, initialLead, units));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(quotation);
  const net = formNetTotal({
    price: form.unit_price,
    discount: form.discount_amount,
    tax: form.tax_amount,
  });

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'customer_id' && value) next.lead_id = '';
        if (field === 'lead_id' && value) next.customer_id = '';
        if (field === 'unit_id' && value) {
          const unit = units.find((row) => row.id === value);
          if (unit && !next.unit_price) next.unit_price = unit.sale_price ?? '';
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
        customer_id: form.customer_id || null,
        lead_id: form.lead_id || null,
        unit_id: form.unit_id,
        salesperson_id: form.salesperson_id || null,
        quotation_date: form.quotation_date || null,
        valid_until: form.valid_until || null,
        unit_price: form.unit_price === '' ? 0 : form.unit_price,
        discount_amount: form.discount_amount === '' ? 0 : form.discount_amount,
        tax_amount: form.tax_amount === '' ? 0 : form.tax_amount,
        terms: form.terms || null,
      };
      if (!editing) payload.status = form.status;
      const saved = editing
        ? await salesApiService.updateQuotation(quotation.id, payload)
        : await salesApiService.createQuotation(payload);
      addToast(
        editing ? 'Quotation updated.' : `Quotation ${saved.number} was created.`,
        'success',
      );
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The quotation could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit ${quotation.number}` : 'Add quotation'}
      description="Price a unit for a customer or lead, then track the response."
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
            form="quotation-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save quotation' : 'Add quotation'}
          </button>
        </>
      }
    >
      <form id="quotation-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Customer"
            id="quotation-customer"
            as="select"
            value={form.customer_id}
            onChange={updateField('customer_id')}
            error={errors.customer_id}
            hint="Choose a customer or a lead."
          >
            <option value="">No customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Lead"
            id="quotation-lead"
            as="select"
            value={form.lead_id}
            onChange={updateField('lead_id')}
            error={errors.lead_id}
          >
            <option value="">No lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Unit"
            id="quotation-unit"
            as="select"
            value={form.unit_id}
            onChange={updateField('unit_id')}
            error={errors.unit_id}
            required
          >
            <option value="">Choose a unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {projectNameFor(unit)} · {unit.unit_number}
              </option>
            ))}
          </FormField>
          <FormField
            label="Salesperson"
            id="quotation-salesperson"
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
            label="Quotation date"
            id="quotation-date"
            type="date"
            value={form.quotation_date}
            onChange={updateField('quotation_date')}
            error={errors.quotation_date}
          />
          <FormField
            label="Valid until"
            id="quotation-valid"
            type="date"
            value={form.valid_until}
            onChange={updateField('valid_until')}
            error={errors.valid_until}
          />
          <FormField
            label={`Unit price (${currency})`}
            id="quotation-price"
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={updateField('unit_price')}
            error={errors.unit_price}
          />
          <FormField
            label={`Discount (${currency})`}
            id="quotation-discount"
            type="number"
            min="0"
            step="0.01"
            value={form.discount_amount}
            onChange={updateField('discount_amount')}
            error={errors.discount_amount}
          />
          <FormField
            label={`Tax (${currency})`}
            id="quotation-tax"
            type="number"
            min="0"
            step="0.01"
            value={form.tax_amount}
            onChange={updateField('tax_amount')}
            error={errors.tax_amount}
          />
          <FormField
            label="Status"
            id="quotation-status"
            as="select"
            value={form.status}
            onChange={updateField('status')}
            error={errors.status}
          >
            {quotationStatusOptions
              .filter((option) => ['draft', 'sent'].includes(option.value))
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </FormField>
          <FormField
            label="Terms"
            id="quotation-terms"
            as="textarea"
            rows="3"
            className="admin-form-grid__full"
            value={form.terms}
            onChange={updateField('terms')}
            error={errors.terms}
          />
        </div>

        <div className="sales-total-preview">
          <span>Net amount</span>
          <strong>{formatPrice(net, currency)}</strong>
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
