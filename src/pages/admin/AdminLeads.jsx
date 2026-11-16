import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, LoaderCircle, Plus, Search, UserPlus, X } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import LeadTable from '../../components/admin/crm/LeadTable';
import LeadFormModal from '../../components/admin/crm/LeadFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import crmApiService from '../../services/crmApiService';
import { leadStageOptions } from '../../services/crmSelectors';

export default function AdminLeads() {
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const canCreate = hasPermission('leads.create');
  const canEdit = hasPermission('leads.edit');
  const canDelete = hasPermission('leads.delete');

  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get('status') || 'open',
  );
  const [sourceFilter, setSourceFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);

  const [leadForm, setLeadForm] = useState({ open: false, lead: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      adminApiService.getLookups().catch(() => ({ users: [], sources: [] })),
      inventoryApiService.listProjects({}).catch(() => ({ data: [] })),
      inventoryApiService.listUnits({ limit: 100 }).catch(() => ({ data: [] })),
    ])
      .then(([lookups, projectResult, unitResult]) => {
        if (ignore) return;
        setSources(lookups.sources || []);
        setUsers(lookups.users || []);
        setProjects(projectResult.data || []);
        setUnits(unitResult.data || []);
      })
      .catch(() => {
        if (!ignore) {
          setSources([]);
          setUsers([]);
          setProjects([]);
          setUnits([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    crmApiService
      .listLeads({
        search: debouncedSearch,
        status: statusFilter,
        source_id: sourceFilter,
        assigned_to: assigneeFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setLeads(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Leads could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, sourceFilter, assigneeFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await crmApiService.deleteLead(deleteTarget.id);
      addToast(`Lead ${deleteTarget.name} was deleted.`, 'success');
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDeleteError(error.message || 'The lead could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(
    search || statusFilter !== 'open' || sourceFilter || assigneeFilter,
  );

  return (
    <>
      <PageMeta
        title="Leads"
        description="Capture enquiries and move them through the sales pipeline."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Leads</h1>
            <p className="admin-page__description">
              Every enquiry, its owner and the project or unit the customer is interested in.
              Open a lead to record follow-ups and convert it to a customer.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setLeadForm({ open: true, lead: null })}
            >
              <Plus size={16} aria-hidden="true" />
              Add lead
            </button>
          ) : null}
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar">
            <label className="admin-toolbar__search">
              <Search size={16} className="admin-toolbar__search-icon" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search name, phone or email"
                aria-label="Search leads"
              />
              {search ? (
                <button
                  type="button"
                  className="admin-toolbar__clear"
                  onClick={() => {
                    setSearch('');
                    resetPage();
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="admin-toolbar__filters">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by stage"
              >
                <option value="">All stages</option>
                <option value="open">Open leads</option>
                {leadStageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by source"
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <select
                value={assigneeFilter}
                onChange={(event) => {
                  setAssigneeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by assignee"
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
                  {meta.total} lead{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading leads…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Leads could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !leads.length ? (
            <EmptyState
              icon={UserPlus}
              title="No leads found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Add the first lead to start working the pipeline.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setLeadForm({ open: true, lead: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add lead
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && leads.length ? (
            <>
              <LeadTable
                leads={leads}
                currency={company?.currency || 'USD'}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={(lead) => setLeadForm({ open: true, lead })}
                onDelete={(lead) => {
                  setDeleteError('');
                  setDeleteTarget(lead);
                }}
              />
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Lead pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {leadForm.open ? (
        <LeadFormModal
          key={leadForm.lead?.id || 'new'}
          lead={leadForm.lead}
          projects={projects}
          units={units}
          users={users}
          sources={sources}
          onClose={() => setLeadForm({ open: false, lead: null })}
          onSaved={() => setReloadKey((value) => value + 1)}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete lead"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? The lead and its follow-up history will be hidden from the workspace.`
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
              {deleting ? 'Deleting…' : 'Delete lead'}
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
