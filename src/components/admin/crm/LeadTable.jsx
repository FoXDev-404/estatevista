import { Link } from 'react-router-dom';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import {
  budgetLabel,
  labelFor,
  leadInterestLabel,
  leadStageOptions,
  leadStageTone,
} from '../../../services/crmSelectors';
import { formatDateTime } from '../../../services/adminFormatters';

export default function LeadTable({
  leads = [],
  currency = 'USD',
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}) {
  return (
    <div className="admin-table__scroll">
      <table className="admin-table admin-lead-table">
        <thead>
          <tr>
            <th scope="col">Lead</th>
            <th scope="col">Interest</th>
            <th scope="col">Budget</th>
            <th scope="col">Next follow-up</th>
            <th scope="col">Assigned to</th>
            <th scope="col">Stage</th>
            <th scope="col" className="admin-table__actions-head">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <th scope="row">
                <span className="admin-table__stack">
                  <Link className="admin-table__title" to={`/admin/leads/${lead.id}`}>
                    {lead.name}
                  </Link>
                  <span className="admin-table__muted">{lead.phone || lead.email || '—'}</span>
                </span>
              </th>
              <td>{leadInterestLabel(lead)}</td>
              <td>{budgetLabel(lead, currency)}</td>
              <td>
                {lead.next_followup_at ? (
                  formatDateTime(lead.next_followup_at)
                ) : (
                  <span className="admin-table__muted">Not scheduled</span>
                )}
              </td>
              <td>
                {lead.assigned_user?.name || (
                  <span className="admin-table__muted">Unassigned</span>
                )}
              </td>
              <td>
                <span className={`admin-badge admin-badge--${leadStageTone(lead.status)}`}>
                  {labelFor(leadStageOptions, lead.status)}
                </span>
              </td>
              <td>
                <div className="table-actions">
                  <Link className="table-action" to={`/admin/leads/${lead.id}`}>
                    <ArrowRight size={15} aria-hidden="true" />
                    <span>Open</span>
                  </Link>
                  {canEdit ? (
                    <button type="button" className="table-action" onClick={() => onEdit(lead)}>
                      <Pencil size={15} aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="table-action table-action--danger"
                      onClick={() => onDelete(lead)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
