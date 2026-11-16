import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  Landmark,
  LoaderCircle,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/properties/Pagination';
import RentReceiptModal from '../../components/admin/rental/RentReceiptModal';
import { useAuth } from '../../hooks/useAuth';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import rentalApiService from '../../services/rentalApiService';
import {
  labelFor,
  rentStatusOptions,
  rentTone,
} from '../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminRentRoll() {
  const [searchParams] = useSearchParams();
  const { hasPermission, company } = useAuth();
  const canCollect = hasPermission('rent.collect');
  const currency = company?.currency || 'USD';
  const leaseFilter = searchParams.get('lease') || '';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [collectTarget, setCollectTarget] = useState(null);

  useEffect(() => {
    let ignore = false;

    rentalApiService
      .listRentRoll({
        search: debouncedSearch,
        status: statusFilter,
        lease_id: leaseFilter,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        limit: 50,
      })
      .then((result) => {
        if (ignore) return;
        setRows(result.data);
        setMeta(result.meta);
        setSummary(result.summary);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'The rent roll could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, leaseFilter, dateFrom, dateTo, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  const hasFilters = Boolean(search || statusFilter || leaseFilter || dateFrom || dateTo);
  const leasedRows = leaseFilter
    ? rows.filter((row) => row.lease_id === leaseFilter)
    : rows;
  const filterLease = leaseFilter
    ? leasedRows[0] || rows.find((row) => row.lease_id === leaseFilter) || null
    : null;

  return (
    <>
      <PageMeta
        title="Rent roll"
        description="Rent periods, collections and outstanding balances."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Rental</p>
            <h1 className="admin-page__title">Rent roll</h1>
            <p className="admin-page__description">
              Every rent period across active leases. Aging comes from the due date and the
              lease grace period.
            </p>
          </div>
          {leaseFilter ? (
            <span className="admin-badge admin-badge--muted">
              Lease {filterLease?.lease_number || leaseFilter}
            </span>
          ) : null}
        </div>

        <div className="admin-stats" aria-label="Rent statistics">
          <div className="admin-stat">
            <span className="admin-stat__icon" aria-hidden="true">
              <Landmark size={18} />
            </span>
            <span className="admin-stat__value">
              {formatPrice(summary?.collected || 0, currency)}
            </span>
            <span className="admin-stat__label">Collected</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon" aria-hidden="true">
              <CalendarClock size={18} />
            </span>
            <span className="admin-stat__value">
              {formatPrice(summary?.balance_due || 0, currency)}
            </span>
            <span className="admin-stat__label">Balance due</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon" aria-hidden="true">
              <TriangleAlert size={18} />
            </span>
            <span className="admin-stat__value">
              {formatPrice(summary?.overdue_amount || 0, currency)}
            </span>
            <span className="admin-stat__label">Overdue</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon" aria-hidden="true">
              <Banknote size={18} />
            </span>
            <span className="admin-stat__value">
              {formatPrice(summary?.paid_in_advance || 0, currency)}
            </span>
            <span className="admin-stat__label">Paid in advance</span>
          </div>
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
                placeholder="Search lease, tenant, unit or period"
                aria-label="Search rent roll"
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
                aria-label="Filter by rent status"
              >
                <option value="">All statuses</option>
                <option value="open">Open periods</option>
                {rentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  resetPage();
                }}
                aria-label="Due from"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  resetPage();
                }}
                aria-label="Due to"
              />
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} period{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading the rent roll…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>The rent roll could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !rows.length ? (
            <EmptyState
              icon={CalendarClock}
              title="No rent periods found"
              description={
                hasFilters
                  ? 'Try a different search, status or date range.'
                  : 'Activate a lease to generate its rent schedule.'
              }
            />
          ) : null}

          {status === 'ready' && rows.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Lease</th>
                      <th scope="col">Tenant</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Due</th>
                      <th scope="col">Rent</th>
                      <th scope="col">Adjustments</th>
                      <th scope="col">Paid</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{row.period_label}</span>
                            <span className="admin-table__muted">
                              {formatDate(row.period_start)} → {formatDate(row.period_end)}
                            </span>
                          </span>
                        </th>
                        <td>{row.lease_number || '—'}</td>
                        <td>{row.tenant?.name || '—'}</td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{row.unit?.unit_number || '—'}</span>
                            <span className="admin-table__muted">
                              {row.unit?.project?.name || ''}
                            </span>
                          </span>
                        </td>
                        <td>{formatDate(row.due_date)}</td>
                        <td>{formatPrice(row.rent_amount || 0, currency)}</td>
                        <td>{formatPrice(row.adjustments || 0, currency)}</td>
                        <td>{formatPrice(row.paid_amount || 0, currency)}</td>
                        <td>
                          <span
                            className={Number(row.balance || 0) > 0 ? 'sales-balance' : undefined}
                          >
                            {formatPrice(row.balance || 0, currency)}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge--${rentTone(row.status)}`}>
                            {labelFor(rentStatusOptions, row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {canCollect &&
                            row.lease_id &&
                            row.tenant_id &&
                            !['paid', 'waived', 'cancelled'].includes(row.status) &&
                            Number(row.balance || 0) > 0 ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  setCollectTarget({
                                    leaseId: row.lease_id,
                                    tenantId: row.tenant_id,
                                    tenantName: row.tenant?.name,
                                  })
                                }
                              >
                                <Banknote size={15} aria-hidden="true" />
                                <span>Collect</span>
                              </button>
                            ) : (
                              <span className="admin-table__muted">—</span>
                            )}
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
                  label="Rent roll pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {collectTarget ? (
        <RentReceiptModal
          leaseId={collectTarget.leaseId}
          tenantId={collectTarget.tenantId}
          tenantName={collectTarget.tenantName}
          currency={currency}
          onClose={() => setCollectTarget(null)}
          onSaved={() => {
            setCollectTarget(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
