import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import VisitFormModal from '../../components/admin/crm/VisitFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import crmApiService from '../../services/crmApiService';
import {
  labelFor,
  visitActions,
  visitStatusOptions,
  visitStatusTone,
} from '../../services/crmSelectors';
import { formatDateTime } from '../../services/adminFormatters';

function visitParty(visit) {
  if (visit.lead) return { type: 'Lead', ...visit.lead };
  if (visit.customer) return { type: 'Customer', ...visit.customer };
  return null;
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', month: '', time: '' };
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  };
}

export default function AdminVisits() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('visits.create');
  const canEdit = hasPermission('visits.edit');
  const canDelete = hasPermission('visits.delete');

  const [visits, setVisits] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [when, setWhen] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [salespersonFilter, setSalespersonFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [users, setUsers] = useState([]);

  const [visitForm, setVisitForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      crmApiService.listLeads({ limit: 100 }).catch(() => ({ data: [] })),
      crmApiService.listCustomers({ limit: 100 }).catch(() => ({ data: [] })),
      inventoryApiService.listProjects({}).catch(() => ({ data: [] })),
      inventoryApiService.listUnits({ limit: 100 }).catch(() => ({ data: [] })),
      adminApiService.getLookups().catch(() => ({ users: [] })),
    ]).then(([leadResult, customerResult, projectResult, unitResult, lookups]) => {
      if (ignore) return;
      setLeads(leadResult.data || []);
      setCustomers(customerResult.data || []);
      setProjects(projectResult.data || []);
      setUnits(unitResult.data || []);
      setUsers(lookups.users || []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    crmApiService
      .listVisits({
        when,
        status: statusFilter,
        project_id: projectFilter,
        salesperson_id: salespersonFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setVisits(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Visits could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [when, statusFilter, projectFilter, salespersonFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  async function changeStatus(visit, nextStatus) {
    setBusyId(visit.id);
    try {
      await crmApiService.updateVisit(visit.id, { status: nextStatus });
      addToast(`Visit marked ${labelFor(visitStatusOptions, nextStatus).toLowerCase()}.`, 'success');
      refresh();
    } catch (error) {
      addToast(error.message || 'The visit could not be updated.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await crmApiService.deleteVisit(deleteTarget.id);
      addToast('Visit deleted.', 'success');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setDeleteError(error.message || 'The visit could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(
    when !== 'upcoming' || statusFilter || projectFilter || salespersonFilter,
  );

  return (
    <>
      <PageMeta
        title="Visits"
        description="Schedule and track site visits for leads and customers."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Site visits</h1>
            <p className="admin-page__description">
              Every scheduled visit, who is attending and the project or unit the customer wants
              to see. Close a visit as completed, cancelled or a no-show.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setVisitForm({ defaults: {} })}
            >
              <Plus size={16} aria-hidden="true" />
              Schedule visit
            </button>
          ) : null}
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters crm-visit-filters">
              <select
                value={when}
                onChange={(event) => {
                  setWhen(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by date"
              >
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="">All dates</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {visitStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={projectFilter}
                onChange={(event) => {
                  setProjectFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by project"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                value={salespersonFilter}
                onChange={(event) => {
                  setSalespersonFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by salesperson"
              >
                <option value="">Everyone</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} visit{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading visits…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Visits could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !visits.length ? (
            <EmptyState
              icon={CalendarDays}
              title="No visits found"
              description={
                hasFilters
                  ? 'Try a different date, status or project filter.'
                  : 'Schedule the first site visit for a lead or customer.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setVisitForm({ defaults: {} })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Schedule visit
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && visits.length ? (
            <>
              <div className="crm-visit-list">
                {visits.map((visit) => {
                  const party = visitParty(visit);
                  const parts = dateParts(visit.scheduled_at);
                  return (
                    <article key={visit.id} className="crm-visit-card">
                      <div className="crm-visit-date" title={formatDateTime(visit.scheduled_at)}>
                        <span className="crm-visit-date__day">{parts.day}</span>
                        <span className="crm-visit-date__month">{parts.month}</span>
                        <span className="crm-visit-date__time">{parts.time}</span>
                      </div>
                      <div className="crm-visit-card__body">
                        <div className="crm-visit-card__header">
                          <div>
                            <h2 className="crm-visit-card__title">
                              {party ? (
                                party.type === 'Lead' ? (
                                  <Link to={`/admin/leads/${party.id}`}>{party.name}</Link>
                                ) : (
                                  <Link
                                    to={`/admin/customers?search=${encodeURIComponent(party.name)}`}
                                  >
                                    {party.name}
                                  </Link>
                                )
                              ) : (
                                'Unlinked visit'
                              )}
                            </h2>
                            <p className="crm-visit-card__meta">
                              {party ? `${party.type} · ` : ''}
                              {visit.project?.name || 'No project'}
                              {visit.unit?.unit_number ? ` · Unit ${visit.unit.unit_number}` : ''}
                              {visit.salesperson?.name ? ` · ${visit.salesperson.name}` : ''}
                            </p>
                          </div>
                          <span className={`admin-badge admin-badge--${visitStatusTone(visit.status)}`}>
                            {labelFor(visitStatusOptions, visit.status)}
                          </span>
                        </div>

                        {visit.notes ? <p className="crm-visit-card__notes">{visit.notes}</p> : null}

                        <div className="crm-visit-card__actions">
                          {canEdit ? (
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => setVisitForm({ visit })}
                            >
                              <Pencil size={15} aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          ) : null}
                          {canEdit
                            ? visitActions(visit.status).map((action) => (
                                <button
                                  key={action.status}
                                  type="button"
                                  className={`table-action${
                                    action.status === 'cancelled' || action.status === 'no_show'
                                      ? ' table-action--danger'
                                      : ''
                                  }`}
                                  onClick={() => changeStatus(visit, action.status)}
                                  disabled={busyId === visit.id}
                                >
                                  <UserCheck size={15} aria-hidden="true" />
                                  <span>{action.label}</span>
                                </button>
                              ))
                            : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className="table-action table-action--danger"
                              onClick={() => {
                                setDeleteError('');
                                setDeleteTarget(visit);
                              }}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Visit pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {visitForm ? (
        <VisitFormModal
          key={visitForm.visit?.id || 'new-visit'}
          visit={visitForm.visit || null}
          defaults={visitForm.defaults || {}}
          leads={leads}
          customers={customers}
          projects={projects}
          units={units}
          users={users}
          onClose={() => setVisitForm(null)}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete visit"
        description={
          deleteTarget
            ? `Delete the visit on ${formatDateTime(deleteTarget.scheduled_at)}?`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {deleting ? 'Deleting…' : 'Delete visit'}
            </button>
          </>
        }
      >
        {deleteError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{deleteError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">This action is recorded in the audit log.</p>
        )}
      </Modal>
    </>
  );
}
