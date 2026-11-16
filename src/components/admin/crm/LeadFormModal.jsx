import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import crmApiService from '../../../services/crmApiService';
import { leadStageOptions } from '../../../services/crmSelectors';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  source_id: '',
  status: 'new',
  assigned_to: '',
  lost_reason: '',
  project_id: '',
  unit_id: '',
  budget_min: '',
  budget_max: '',
  notes: '',
};

function initialForm(lead) {
  if (!lead) return EMPTY_FORM;
  return {
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    source_id: lead.source_id || '',
    status: lead.status || 'new',
    assigned_to: lead.assigned_to || '',
    lost_reason: lead.lost_reason || '',
    project_id: lead.project_id || '',
    unit_id: lead.unit_id || '',
    budget_min: lead.budget_min ?? '',
    budget_max: lead.budget_max ?? '',
    notes: lead.notes || '',
  };
}

export default function LeadFormModal({
  lead = null,
  projects = [],
  units = [],
  users = [],
  sources = [],
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => initialForm(lead));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(lead);

  const unitOptions = form.project_id
    ? units.filter((unit) => unit.project_id === form.project_id)
    : units;

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'project_id') {
          const allowed = units.filter((unit) => unit.project_id === value);
          if (!allowed.some((unit) => unit.id === next.unit_id)) next.unit_id = '';
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
        ...form,
        source_id: form.source_id || null,
        assigned_to: form.assigned_to || null,
        project_id: form.project_id || null,
        unit_id: form.unit_id || null,
        budget_min: form.budget_min === '' ? null : form.budget_min,
        budget_max: form.budget_max === '' ? null : form.budget_max,
        lost_reason: form.status === 'lost' ? form.lost_reason : null,
      };
      const saved = editing
        ? await crmApiService.updateLead(lead.id, payload)
        : await crmApiService.createLead(payload);
      addToast(editing ? 'Lead updated.' : `Lead ${saved.name} was added.`, 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The lead could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? `Edit ${lead.name}` : 'Add lead'}
      description="Capture the enquiry, owner and the project or unit the customer is interested in."
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
            form="lead-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save lead' : 'Add lead'}
          </button>
        </>
      }
    >
      <form id="lead-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Name"
            id="lead-name"
            value={form.name}
            onChange={updateField('name')}
            error={errors.name}
            required
          />
          <FormField
            label="Phone"
            id="lead-phone"
            type="tel"
            value={form.phone}
            onChange={updateField('phone')}
            error={errors.phone}
            hint="Phone or email is required."
          />
          <FormField
            label="Email"
            id="lead-email"
            type="email"
            value={form.email}
            onChange={updateField('email')}
            error={errors.email}
          />
          <FormField
            label="Source"
            id="lead-source"
            as="select"
            value={form.source_id}
            onChange={updateField('source_id')}
            error={errors.source_id}
          >
            <option value="">No source</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Stage"
            id="lead-status"
            as="select"
            value={form.status}
            onChange={updateField('status')}
            error={errors.status}
            required
          >
            {leadStageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Assigned to"
            id="lead-assigned"
            as="select"
            value={form.assigned_to}
            onChange={updateField('assigned_to')}
            error={errors.assigned_to}
          >
            <option value="">Unassigned</option>
            {users
              .filter((user) => user.is_active !== false)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </FormField>
          {form.status === 'lost' ? (
            <FormField
              label="Reason lost"
              id="lead-lost-reason"
              className="admin-form-grid__full"
              value={form.lost_reason}
              onChange={updateField('lost_reason')}
              error={errors.lost_reason}
              required
            />
          ) : null}
          <FormField
            label="Project"
            id="lead-project"
            as="select"
            value={form.project_id}
            onChange={updateField('project_id')}
            error={errors.project_id}
          >
            <option value="">Any project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Unit"
            id="lead-unit"
            as="select"
            value={form.unit_id}
            onChange={updateField('unit_id')}
            error={errors.unit_id}
          >
            <option value="">Any unit</option>
            {unitOptions.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_number} · {unit.status}
              </option>
            ))}
          </FormField>
          <FormField
            label="Budget min"
            id="lead-budget-min"
            type="number"
            min="0"
            step="0.01"
            value={form.budget_min}
            onChange={updateField('budget_min')}
            error={errors.budget_min}
          />
          <FormField
            label="Budget max"
            id="lead-budget-max"
            type="number"
            min="0"
            step="0.01"
            value={form.budget_max}
            onChange={updateField('budget_max')}
            error={errors.budget_max}
          />
          <FormField
            label="Notes"
            id="lead-notes"
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
