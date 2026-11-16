import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Clock,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import QuotationFormModal from '../../components/admin/sales/QuotationFormModal';
import SaleFormModal from '../../components/admin/sales/SaleFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import crmApiService from '../../services/crmApiService';
import inventoryApiService from '../../services/inventoryApiService';
import salesApiService from '../../services/salesApiService';
import {
  labelFor,
  quotationStatusOptions,
  quotationTone,
} from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

function customerLabel(quotation) {
  if (quotation.customer) return quotation.customer.name;
  if (quotation.lead) return `${quotation.lead.name} (lead)`;
  return '—';
}

export default function AdminQuotations() {
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadParam = searchParams.get('lead');
  const canCreate = hasPermission('quotations.create');
  const canEdit = hasPermission('quotations.edit');
  const canDelete = hasPermission('quotations.delete');
  const canCreateSale = hasPermission('sales.create');
  const currency = company?.currency || 'USD';

  const [quotations, setQuotations] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [lookups, setLookups] = useState({
    customers: [],
    leads: [],
    units: [],
    users: [],
    projects: [],
  });
  const [form, setForm] = useState({ open: false, quotation: null, initialLead: null });
  const [salePrefill, setSalePrefill] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;

    function openFromLead() {
      if (!leadParam) return;
      crmApiService
        .getLead(leadParam)
        .then((lead) => {
          if (!ignore && lead) {
            setForm({ open: true, quotation: null, initialLead: lead });
          }
        })
        .catch(() => null);
    }

    Promise.all([
      crmApiService.listCustomers({ limit: 100 }),
      crmApiService.listLeads({ limit: 100 }),
      inventoryApiService.listUnits({ limit: 100 }),
      inventoryApiService.listProjects({ limit: 100 }),
      adminApiService.getLookups(),
    ])
      .then(([customerResult, leadResult, unitResult, projectResult, lookupData]) => {
        if (ignore) return;
        setLookups({
          customers: customerResult.data,
          leads: leadResult.data,
          units: unitResult.data,
          projects: projectResult.data,
          users: lookupData.users || [],
        });
        openFromLead();
      })
      .catch(() => {
        if (!ignore) openFromLead();
      });

    return () => {
      ignore = true;
    };
  }, [leadParam]);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listQuotations({
        search: debouncedSearch,
        status: statusFilter,
        project_id: projectFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setQuotations(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Quotations could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, projectFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  async function changeStatus(quotation, nextStatus) {
    setBusyId(quotation.id);
    try {
      await salesApiService.setQuotationStatus(quotation.id, nextStatus);
      addToast(
        `${quotation.number} marked ${labelFor(quotationStatusOptions, nextStatus).toLowerCase()}.`,
        'success',
      );
      refresh();
    } catch (error) {
      addToast(error.message || 'The quotation status could not be changed.', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await salesApiService.deleteQuotation(deleteTarget.id);
      addToast(`Quotation ${deleteTarget.number} was deleted.`, 'success');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setDeleteError(error.message || 'The quotation could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search || statusFilter || projectFilter);

  return (
    <>
      <PageMeta
        title="Quotations"
        description="Price units for customers and track the response."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Quotations</h1>
            <p className="admin-page__description">
              Send a priced offer for a unit, record the customer response and turn an accepted
              quotation into a sale.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setForm({ open: true, quotation: null, initialLead: null })}
            >
              <Plus size={16} aria-hidden="true" />
              Add quotation
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
                placeholder="Search number, customer or unit"
                aria-label="Search quotations"
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
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {quotationStatusOptions.map((option) => (
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
                {lookups.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} quotation{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading quotations…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Quotations could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !quotations.length ? (
            <EmptyState
              icon={FileText}
              title="No quotations found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Price a unit for a customer or lead to start the sales cycle.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setForm({ open: true, quotation: null, initialLead: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add quotation
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && quotations.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Quotation</th>
                      <th scope="col">Customer / lead</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Net amount</th>
                      <th scope="col">Valid until</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((quotation) => {
                      const busy = busyId === quotation.id;
                      return (
                        <tr key={quotation.id}>
                          <th scope="row">
                            <span className="admin-table__stack">
                              <span className="admin-table__title">{quotation.number}</span>
                              <span className="admin-table__muted">
                                {formatDate(quotation.quotation_date)}
                              </span>
                            </span>
                          </th>
                          <td>{customerLabel(quotation)}</td>
                          <td>
                            <span className="admin-table__stack">
                              <span>{quotation.unit?.unit_number || '—'}</span>
                              <span className="admin-table__muted">
                                {quotation.unit?.project?.name || ''}
                              </span>
                            </span>
                          </td>
                          <td>{formatPrice(quotation.net_amount || 0, currency)}</td>
                          <td>
                            {quotation.valid_until ? formatDate(quotation.valid_until) : '—'}
                          </td>
                          <td>
                            <span
                              className={`admin-badge admin-badge--${quotationTone(quotation.status)}`}
                            >
                              {labelFor(quotationStatusOptions, quotation.status)}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {quotation.status === 'draft' && canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    className="table-action"
                                    onClick={() => setForm({ open: true, quotation, initialLead: null })}
                                    disabled={busy}
                                  >
                                    <Pencil size={15} aria-hidden="true" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action"
                                    onClick={() => changeStatus(quotation, 'sent')}
                                    disabled={busy}
                                  >
                                    <Send size={15} aria-hidden="true" />
                                    <span>Send</span>
                                  </button>
                                </>
                              ) : null}
                              {quotation.status === 'sent' && canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    className="table-action"
                                    onClick={() => changeStatus(quotation, 'accepted')}
                                    disabled={busy}
                                  >
                                    <Check size={15} aria-hidden="true" />
                                    <span>Accept</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action table-action--danger"
                                    onClick={() => changeStatus(quotation, 'rejected')}
                                    disabled={busy}
                                  >
                                    <X size={15} aria-hidden="true" />
                                    <span>Reject</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="table-action"
                                    onClick={() => changeStatus(quotation, 'expired')}
                                    disabled={busy}
                                  >
                                    <Clock size={15} aria-hidden="true" />
                                    <span>Expire</span>
                                  </button>
                                </>
                              ) : null}
                              {quotation.status === 'accepted' && canCreateSale ? (
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() =>
                                    setSalePrefill({ source: 'quotation', record: quotation })
                                  }
                                >
                                  <FileText size={15} aria-hidden="true" />
                                  <span>Create sale</span>
                                </button>
                              ) : null}
                              {quotation.status === 'draft' && canDelete ? (
                                <button
                                  type="button"
                                  className="table-action table-action--danger"
                                  onClick={() => {
                                    setDeleteError('');
                                    setDeleteTarget(quotation);
                                  }}
                                  disabled={busy}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              ) : null}
                              {quotation.status === 'converted' && quotation.id ? (
                                <span className="admin-table__muted">Converted to sale</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Quotation pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {form.open ? (
        <QuotationFormModal
          key={form.quotation?.id || form.initialLead?.id || 'new'}
          quotation={form.quotation}
          initialLead={form.initialLead}
          customers={lookups.customers}
          leads={lookups.leads}
          units={lookups.units}
          users={lookups.users}
          currency={currency}
          onClose={() => setForm({ open: false, quotation: null, initialLead: null })}
          onSaved={refresh}
        />
      ) : null}

      {salePrefill ? (
        <SaleFormModal
          customers={lookups.customers}
          units={lookups.units}
          users={lookups.users}
          prefill={salePrefill}
          currency={currency}
          onClose={() => setSalePrefill(null)}
          onSaved={(sale) => navigate(`/admin/sales/${sale.id}`)}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete quotation"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.number}? Only draft quotations can be deleted.`
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
              {deleting ? 'Deleting…' : 'Delete quotation'}
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
