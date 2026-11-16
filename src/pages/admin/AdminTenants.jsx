import { useEffect, useState } from 'react';
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import TenantFormModal from '../../components/admin/rental/TenantFormModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import rentalApiService from '../../services/rentalApiService';
import {
  labelFor,
  tenantOccupancyOptions,
  tenantTypeOptions,
} from '../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminTenants() {
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('tenants.create');
  const canEdit = hasPermission('tenants.edit');
  const canDelete = hasPermission('tenants.delete');
  const currency = company?.currency || 'USD';

  const [tenants, setTenants] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [form, setForm] = useState({ open: false, tenant: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;
    rentalApiService
      .listTenants({
        search: debouncedSearch,
        type: typeFilter,
        occupancy: occupancyFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setTenants(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Tenants could not be loaded.');
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, [debouncedSearch, typeFilter, occupancyFilter, page, reloadKey]);

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
      await rentalApiService.deleteTenant(deleteTarget.id);
      addToast(`Tenant ${deleteTarget.name} was deleted.`, 'success');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      setDeleteError(error.message || 'The tenant could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search || typeFilter || occupancyFilter);

  return (
    <>
      <PageMeta
        title="Tenants"
        description="Tenant records, current occupancy and lease balances."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Rental</p>
            <h1 className="admin-page__title">Tenants</h1>
            <p className="admin-page__description">
              Keep contact and identification details for every renter. Current occupancy is
              derived from active leases.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setForm({ open: true, tenant: null })}
            >
              <Plus size={16} aria-hidden="true" />
              Add tenant
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
                placeholder="Search name, phone, email or unit"
                aria-label="Search tenants"
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
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by tenant type"
              >
                <option value="">All types</option>
                {tenantTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={occupancyFilter}
                onChange={(event) => {
                  setOccupancyFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by occupancy"
              >
                <option value="">All tenants</option>
                {tenantOccupancyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} tenant{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading tenants…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Tenants could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !tenants.length ? (
            <EmptyState
              icon={Users}
              title="No tenants found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Add a tenant before creating a lease.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setForm({ open: true, tenant: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add tenant
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && tenants.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Tenant</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Lease ends</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Type</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{tenant.name}</span>
                            <span className="admin-table__muted">
                              {tenant.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </span>
                        </th>
                        <td>
                          <span className="admin-table__stack">
                            <span>{tenant.phone || '—'}</span>
                            <span className="admin-table__muted">{tenant.email || ''}</span>
                          </span>
                        </td>
                        <td>{tenant.current_unit || '—'}</td>
                        <td>{tenant.lease_ends ? formatDate(tenant.lease_ends) : '—'}</td>
                        <td>
                          <span
                            className={Number(tenant.balance_due || 0) > 0 ? 'sales-balance' : undefined}
                          >
                            {formatPrice(tenant.balance_due || 0, currency)}
                          </span>
                        </td>
                        <td>{labelFor(tenantTypeOptions, tenant.type)}</td>
                        <td>
                          <div className="table-actions">
                            {canEdit ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => setForm({ open: true, tenant })}
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
                                  setDeleteTarget(tenant);
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
                  label="Tenant pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {form.open ? (
        <TenantFormModal
          tenant={form.tenant}
          onClose={() => setForm({ open: false, tenant: null })}
          onSaved={() => {
            setForm({ open: false, tenant: null });
            refresh();
          }}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete tenant"
        description={`Delete ${deleteTarget?.name || 'this tenant'}? The record stays on past leases but disappears from the list.`}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Keep tenant
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {deleting ? 'Deleting…' : 'Delete tenant'}
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
          <p className="admin-modal-note">
            A tenant with an active lease cannot be deleted. End the lease first.
          </p>
        )}
      </Modal>
    </>
  );
}
