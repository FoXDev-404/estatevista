import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import salesApiService from '../../../services/salesApiService';
import {
  commissionApplicabilityOptions,
  commissionRateTypeOptions,
  commissionTriggerOptions,
} from '../../../services/salesSelectors';
import { formatPrice } from '../../../services/formatters';

const EMPTY_FORM = {
  name: '',
  applicability: 'all',
  project_id: '',
  unit_type_id: '',
  rate_type: 'percentage',
  rate_value: '',
  payable_trigger: 'sale',
  is_active: true,
};

function initialForm(rule) {
  if (!rule) return EMPTY_FORM;
  return {
    name: rule.name || '',
    applicability: rule.applicability || 'all',
    project_id: rule.project_id || '',
    unit_type_id: rule.unit_type_id || '',
    rate_type: rule.rate_type || 'percentage',
    rate_value: rule.rate_value ?? '',
    payable_trigger: rule.payable_trigger || 'sale',
    is_active: rule.is_active !== false,
  };
}

export default function CommissionRuleModal({
  rule = null,
  projects = [],
  unitTypes = [],
  currency = 'USD',
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(rule));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(rule);

  function updateField(field) {
    return (event) => {
      const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'applicability') {
          if (value !== 'project') next.project_id = '';
          if (value !== 'unit_type') next.unit_type_id = '';
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
        name: form.name.trim(),
        applicability: form.applicability,
        project_id: form.applicability === 'project' ? form.project_id || null : null,
        unit_type_id: form.applicability === 'unit_type' ? form.unit_type_id || null : null,
        rate_type: form.rate_type,
        rate_value: form.rate_value === '' ? 0 : form.rate_value,
        payable_trigger: form.payable_trigger,
        is_active: form.is_active,
      };
      const saved = editing
        ? await salesApiService.updateCommissionRule(rule.id, payload)
        : await salesApiService.createCommissionRule(payload);
      addToast(
        editing ? 'Commission rule updated.' : `Commission rule ${saved.name} was created.`,
        'success',
      );
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The commission rule could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit ${rule.name}` : 'Add commission rule'}
      description="Select who earns commission, when it becomes payable and how it is calculated."
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
            form="commission-rule-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save rule' : 'Add rule'}
          </button>
        </>
      }
    >
      <form id="commission-rule-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Rule name"
            id="commission-rule-name"
            className="admin-form-grid__full"
            value={form.name}
            onChange={updateField('name')}
            error={errors.name}
            required
          />
          <FormField
            label="Applies to"
            id="commission-rule-applicability"
            as="select"
            value={form.applicability}
            onChange={updateField('applicability')}
            error={errors.applicability}
          >
            {commissionApplicabilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Becomes payable"
            id="commission-rule-trigger"
            as="select"
            value={form.payable_trigger}
            onChange={updateField('payable_trigger')}
            error={errors.payable_trigger}
          >
            {commissionTriggerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          {form.applicability === 'project' ? (
            <FormField
              label="Project"
              id="commission-rule-project"
              as="select"
              value={form.project_id}
              onChange={updateField('project_id')}
              error={errors.project_id}
              required
            >
              <option value="">Choose a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </FormField>
          ) : null}
          {form.applicability === 'unit_type' ? (
            <FormField
              label="Unit type"
              id="commission-rule-unit-type"
              as="select"
              value={form.unit_type_id}
              onChange={updateField('unit_type_id')}
              error={errors.unit_type_id}
              required
            >
              <option value="">Choose a unit type</option>
              {unitTypes.map((unitType) => (
                <option key={unitType.id} value={unitType.id}>
                  {unitType.name}
                </option>
              ))}
            </FormField>
          ) : null}
          <FormField
            label="Rate type"
            id="commission-rule-rate-type"
            as="select"
            value={form.rate_type}
            onChange={updateField('rate_type')}
            error={errors.rate_type}
          >
            {commissionRateTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label={
              form.rate_type === 'percentage'
                ? 'Rate (%)'
                : `Amount per sale (${currency})`
            }
            id="commission-rule-rate"
            type="number"
            min="0"
            step="0.01"
            value={form.rate_value}
            onChange={updateField('rate_value')}
            error={errors.rate_value}
            hint={
              form.rate_type === 'percentage' && Number(form.rate_value) > 0
                ? `A ${formatPrice(100000, currency)} sale earns ${formatPrice(
                    (100000 * Number(form.rate_value)) / 100,
                    currency,
                  )}.`
                : undefined
            }
          />
          <FormField
            label="Active — new sales can use this rule"
            id="commission-rule-active"
            type="checkbox"
            className="admin-form-grid__full"
            checked={form.is_active}
            onChange={updateField('is_active')}
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
