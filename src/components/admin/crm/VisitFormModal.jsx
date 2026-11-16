import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import crmApiService from '../../../services/crmApiService';
import { fromDateTimeInput, toDateTimeInput } from '../../../services/crmSelectors';

function initialForm(visit) {
  if (!visit) return { lead_id: '', customer_id: '', project_id: '', unit_id: '', salesperson_id: '', scheduled_at: '', notes: '' };
  return {
    lead_id: visit.lead_id || '',
    customer_id: visit.customer_id || '',
    project_id: visit.project_id || '',
    unit_id: visit.unit_id || '',
    salesperson_id: visit.salesperson_id || '',
    scheduled_at: toDateTimeInput(visit.scheduled_at),
    notes: visit.notes || '',
  };
}

export default function VisitFormModal({
  visit = null,
  leads = [],
  customers = [],
  projects = [],
  units = [],
  users = [],
  defaults = {},
  onClose,
  onSaved,
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState(() => ({
    ...initialForm(visit),
    ...Object.fromEntries(
      Object.entries(defaults).filter(([, value]) => value !== undefined && value !== null),
    ),
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(visit);

  const unitOptions = form.project_id
    ? units.filter((unit) => unit.project_id === form.project_id)
    : units;

  function updateField(field) {
    return (event) => {
      const value = event.target.value;
      setForm((current) => {
        const next = { ...current, [field]: value };
        if (field === 'lead_id') next.customer_id = '';
        if (field === 'customer_id') next.lead_id = '';
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
        lead_id: form.lead_id || null,
        customer_id: form.customer_id || null,
        project_id: form.project_id,
        unit_id: form.unit_id || null,
        salesperson_id: form.salesperson_id || null,
        scheduled_at: fromDateTimeInput(form.scheduled_at),
        notes: form.notes,
      };
      const saved = editing
        ? await crmApiService.updateVisit(visit.id, payload)
        : await crmApiService.createVisit(payload);
      addToast(editing ? 'Visit updated.' : 'Visit scheduled.', 'success');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The visit could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={editing ? 'Edit visit' : 'Schedule visit'}
      description="Link the visit to a lead or customer and the project they want to see."
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
            form="visit-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : editing ? 'Save visit' : 'Schedule visit'}
          </button>
        </>
      }
    >
      <form id="visit-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Lead"
            id="visit-lead"
            as="select"
            value={form.lead_id}
            onChange={updateField('lead_id')}
            error={errors.lead_id}
            hint="Choose a lead or a customer."
          >
            <option value="">No lead</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Customer"
            id="visit-customer"
            as="select"
            value={form.customer_id}
            onChange={updateField('customer_id')}
            error={errors.customer_id}
          >
            <option value="">No customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Project"
            id="visit-project"
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
          <FormField
            label="Unit"
            id="visit-unit"
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
            label="Salesperson"
            id="visit-salesperson"
            as="select"
            value={form.salesperson_id}
            onChange={updateField('salesperson_id')}
            error={errors.salesperson_id}
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
          <FormField
            label="Date and time"
            id="visit-scheduled"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={updateField('scheduled_at')}
            error={errors.scheduled_at}
            required
          />
          <FormField
            label="Notes"
            id="visit-notes"
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
