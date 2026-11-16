import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  FileSignature,
  LoaderCircle,
  Plus,
  Search,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/properties/Pagination';
import LeaseFormModal from '../../components/admin/rental/LeaseFormModal';
import { useAuth } from '../../hooks/useAuth';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import rentalApiService from '../../services/rentalApiService';
import inventoryApiService from '../../services/inventoryApiService';
import {
  labelFor,
  leaseStatusOptions,
  leaseTone,
} from '../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminLeases() {
  const { hasPermission, company } = useAuth();
  const [searchParams] = useSearchParams();
  const canCreate = hasPermission('leases.create');
  const currency = company?.currency || 'USD';

  const [leases, setLeases] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const tenantFilter = searchParams.get('tenant') || '';

  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      rentalApiService.listTenants({ limit: 100, occupancy: 'without' }).catch(() =>
        rentalApiService.listTenants({ limit: 100 }),
      ),
      inventoryApiService.listUnits({ limit: 100 }),
    ])
      .then(([tenantResult, unitResult]) => {
        if (ignore) return;
        setTenants(tenantResult.data || []);
        setUnits(unitResult.data || []);
      })
      .catch(() => {
        if (!ignore) {
          setTenants([]);
          setUnits([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    rentalApiService
      .listLeases({
        search: debouncedSearch,
        status: statusFilter,
        tenant_id: tenantFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setLeases(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Leases could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, tenantFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  const availableUnits = units.filter((unit) =>
    ['available', 'vacant'].includes(unit.status),
  );
  const hasFilters = Boolean(search || statusFilter || tenantFilter);

  return (
    <>
      <PageMeta
        title="Leases"
        description="Rental agreements, activation, renewals and rent schedules."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Rental</p>
            <h1 className="admin-page__title">Leases</h1>
            <p className="admin-page__description">
              Draft a lease, activate it to generate the rent schedule, then renew, revise or
              terminate as the tenancy changes.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={16} aria-hidden="true" />
              New lease
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
                placeholder="Search number, tenant or unit"
                aria-label="Search leases"
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
                {leaseStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} lease{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading leases…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Leases could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !leases.length ? (
            <EmptyState
              icon={FileSignature}
              title="No leases found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Create a lease for an available unit.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    New lease
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && leases.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Lease</th>
                      <th scope="col">Tenant</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Period</th>
                      <th scope="col">Rent</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leases.map((lease) => (
                      <tr key={lease.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{lease.number}</span>
                            <span className="admin-table__muted">
                              Due day {lease.due_day} · {lease.grace_days} grace days
                            </span>
                          </span>
                        </th>
                        <td>{lease.tenant?.name || '—'}</td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{lease.unit?.unit_number || '—'}</span>
                            <span className="admin-table__muted">
                              {lease.unit?.project?.name || ''}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{formatDate(lease.start_date)}</span>
                            <span className="admin-table__muted">
                              to {formatDate(lease.end_date)}
                            </span>
                          </span>
                        </td>
                        <td>{formatPrice(lease.rent_amount || 0, currency)}</td>
                        <td>
                          <span
                            className={Number(lease.balance_due || 0) > 0 ? 'sales-balance' : undefined}
                          >
                            {formatPrice(lease.balance_due || 0, currency)}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge--${leaseTone(lease.status)}`}>
                            {labelFor(leaseStatusOptions, lease.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link className="table-action" to={`/admin/leases/${lease.id}`}>
                              <span>View lease</span>
                            </Link>
                            {hasPermission('rent.view') && Number(lease.balance_due || 0) > 0 ? (
                              <Link
                                className="table-action"
                                to={`/admin/rent-roll?lease=${lease.id}`}
                              >
                                <span>Rent roll</span>
                              </Link>
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
                  label="Lease pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {formOpen ? (
        <LeaseFormModal
          tenants={tenants}
          units={availableUnits}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
