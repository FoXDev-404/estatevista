import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import crmApiService from '../../../services/crmApiService';
import {
  followupTypeOptions,
  fromDateTimeInput,
} from '../../../services/crmSelectors';

export default function FollowupModal({ leadId, onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ type: 'call', scheduled_at: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
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
      const followup = await crmApiService.addFollowup(leadId, {
        type: form.type,
        scheduled_at: fromDateTimeInput(form.scheduled_at),
        notes: form.notes,
      });
      addToast('Follow-up scheduled.', 'success');
      onSaved?.(followup);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The follow-up could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Schedule follow-up"
      description="Add a call, meeting or note to the lead activity timeline."
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
            form="followup-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Add follow-up'}
          </button>
        </>
      }
    >
      <form id="followup-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Type"
            id="followup-type"
            as="select"
            value={form.type}
            onChange={updateField('type')}
            error={errors.type}
          >
            {followupTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormField>
          <FormField
            label="Scheduled for"
            id="followup-scheduled"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={updateField('scheduled_at')}
            error={errors.scheduled_at}
          />
          <FormField
            label="Notes"
            id="followup-notes"
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
