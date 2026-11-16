import { useEffect, useState } from 'react';
import { ArrowRight, AlertCircle, History, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';
import { formatDateTime } from '../../../services/adminFormatters';
import {
  labelFor,
  nextUnitStatuses,
  statusTone,
  unitStatusOptions,
} from '../../../services/inventorySelectors';

export default function UnitStatusModal({ unit, onClose, onSaved }) {
  const { addToast } = useToast();
  const options = nextUnitStatuses(unit.status);
  const [status, setStatus] = useState(() => options[0] || '');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState('loading');

  useEffect(() => {
    let ignore = false;
    inventoryApiService
      .getUnitHistory(unit.id)
      .then((rows) => {
        if (ignore) return;
        setHistory(rows);
        setHistoryState('ready');
      })
      .catch(() => {
        if (!ignore) setHistoryState('error');
      });

    return () => {
      ignore = true;
    };
  }, [unit.id]);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!status) {
      setErrors({ status: 'Choose the next status.' });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const updated = await inventoryApiService.updateUnitStatus(unit.id, {
        status,
        reason: reason || null,
      });
      addToast(`Unit ${unit.unit_number} is now ${labelFor(unitStatusOptions, status)}.`, 'success');
      onSaved?.(updated);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The unit status could not be changed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title={unit ? `Unit ${unit.unit_number} status` : 'Unit status'}
      description="Every change is recorded with a timestamp and the team member who made it."
      size="large"
      footer={
        <>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={close}
            disabled={saving}
          >
            Close
          </button>
          <button
            type="submit"
            form="unit-status-form"
            className="button button--primary button--md"
            disabled={saving || !options.length}
          >
            {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
            {saving ? 'Changing…' : 'Change status'}
          </button>
        </>
      }
    >
      {unit ? (
        <div className="admin-unit-status">
          <div className="admin-unit-status__current">
            <span className="admin-unit-status__label">Current status</span>
            <span className={`admin-badge admin-badge--${statusTone(unit.status)}`}>
              {labelFor(unitStatusOptions, unit.status)}
            </span>
          </div>

          {options.length ? (
            <form id="unit-status-form" onSubmit={handleSubmit} noValidate>
              <div className="admin-form-grid admin-form-grid--two">
                <FormField
                  label="Next status"
                  id="unit-next-status"
                  as="select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  error={errors.status}
                  required
                >
                  {options.map((value) => (
                    <option key={value} value={value}>
                      {labelFor(unitStatusOptions, value)}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Reason"
                  id="unit-status-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  error={errors.reason}
                  hint="Optional — shown in the unit history."
                />
              </div>
            </form>
          ) : (
            <div className="admin-alert" role="status">
              <AlertCircle size={18} aria-hidden="true" />
              <p>This unit has no available status changes.</p>
            </div>
          )}

          <div className="admin-unit-history">
            <h3 className="admin-unit-history__title">
              <History size={16} aria-hidden="true" />
              Status history
            </h3>

            {historyState === 'loading' ? (
              <div className="admin-loading" role="status">
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
                Loading history…
              </div>
            ) : null}

            {historyState === 'error' ? (
              <p className="admin-modal-note">The status history could not be loaded.</p>
            ) : null}

            {historyState === 'ready' && !history.length ? (
              <p className="admin-modal-note">No status changes have been recorded yet.</p>
            ) : null}

            {historyState === 'ready' && history.length ? (
              <ol className="admin-unit-history__list">
                {history.map((entry) => (
                  <li key={entry.id} className="admin-unit-history__entry">
                    <div className="admin-unit-history__change">
                      <span className={`admin-badge admin-badge--${statusTone(entry.from_status)}`}>
                        {labelFor(unitStatusOptions, entry.from_status)}
                      </span>
                      <ArrowRight size={14} aria-hidden="true" />
                      <span className={`admin-badge admin-badge--${statusTone(entry.to_status)}`}>
                        {labelFor(unitStatusOptions, entry.to_status)}
                      </span>
                    </div>
                    <div className="admin-unit-history__meta">
                      <span>{entry.changed_by_user?.name || 'System'}</span>
                      <span>{formatDateTime(entry.created_at)}</span>
                    </div>
                    {entry.reason ? <p>{entry.reason}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
