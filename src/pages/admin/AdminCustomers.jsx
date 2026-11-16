import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Contact,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import CustomerFormModal from '../../components/admin/crm/CustomerFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import crmApiService from '../../services/crmApiService';
import {
  customerTypeOptions,
  customerTypeTone,
  labelFor,
} from '../../services/crmSelectors';
import { formatNumber, formatPrice } from '../../services/formatters';

export default function AdminCustomers() {
  const [searchParams] = useSearchParams();
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('customers.create');
  const canEdit = hasPermission('customers.edit');
  const canDelete = hasPermission('customers.delete');

  const [customers, setCustomers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [sources, setSources] = useState([]);
  const [customerForm, setCustomerForm] = useState({ open: false, customer: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;
    adminApiService
      .getLookups()
      .then((lookups) => {
        if (!ignore) setSources(lookups.sources || []);
      })
      .catch(() => {
        if (!ignore) setSources([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    crmApiService
      .listCustomers({
        search: debouncedSearch,
        source_id: sourceFilter,
        type: typeFilter,
        status: statusFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setCustomers(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Customers could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, sourceFilter, typeFilter, statusFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await crmApiService.deleteCustomer(deleteTarget.id);
      addToast(`Customer ${deleteTarget.name} was deleted.`, 'success');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setDeleteError(error.message || 'The customer could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search || sourceFilter || typeFilter || statusFilter);
  const currency = company?.currency || 'USD';

  return (
    <>
      <PageMeta
        title="Customers"
        description="Customer records for sales, reservations and leases."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Customers</h1>
            <p className="admin-page__description">
              Converted leads and customers entered directly. Sales and installment totals appear
              here as the commercial modules are used.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setCustomerForm({ open: true, customer: null })}
            >
              <Plus size={16} aria-hidden="true" />
              New customer
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
                aria-label="Search customers"
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
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                {customerTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} customer{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading customers…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Customers could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !customers.length ? (
            <EmptyState
              icon={Contact}
              title="No customers found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Add a customer directly or convert a won lead.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setCustomerForm({ open: true, customer: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    New customer
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && customers.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Source</th>
                      <th scope="col">Units bought</th>
                      <th scope="col">Balance due</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">
                              {customer.name}
                              <span
                                className={`admin-badge admin-badge--${customerTypeTone(customer.type)}`}
                              >
                                {labelFor(customerTypeOptions, customer.type)}
                              </span>
                            </span>
                            {customer.lead ? (
                              <span className="admin-table__muted">From lead {customer.lead.name}</span>
                            ) : null}
                          </span>
                        </th>
                        <td>
                          <span className="admin-table__stack">
                            <span>{customer.phone || '—'}</span>
                            <span className="admin-table__muted">{customer.email || ''}</span>
                          </span>
                        </td>
                        <td>{customer.source?.name || <span className="admin-table__muted">—</span>}</td>
                        <td>{formatNumber(customer.units_bought || 0)}</td>
                        <td>{formatPrice(customer.balance_due || 0, currency)}</td>
                        <td>
                          <span
                            className={`admin-badge admin-badge--${
                              customer.is_active ? 'success' : 'muted'
                            }`}
                          >
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {canEdit ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  setCustomerForm({ open: true, customer })
                                }
                              >
                                <Pencil size={15} aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                className="table-action table-action--danger"
                                onClick={() => {
                                  setDeleteError('');
                                  setDeleteTarget(customer);
                                }}
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
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Customer pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {customerForm.open ? (
        <CustomerFormModal
          key={customerForm.customer?.id || 'new'}
          customer={customerForm.customer}
          sources={sources}
          onClose={() => setCustomerForm({ open: false, customer: null })}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete customer"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? The customer is hidden from the workspace.`
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
              {deleting ? 'Deleting…' : 'Delete customer'}
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
