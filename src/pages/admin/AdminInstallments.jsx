import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CalendarDays,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/properties/Pagination';
import InstallmentActionModal from '../../components/admin/sales/InstallmentActionModal';
import { useAuth } from '../../hooks/useAuth';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import inventoryApiService from '../../services/inventoryApiService';
import salesApiService from '../../services/salesApiService';
import {
  canReschedule,
  canWaive,
  installmentStatusOptions,
  installmentTone,
  labelFor,
} from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminInstallments() {
  const { hasPermission, company } = useAuth();
  const [searchParams] = useSearchParams();
  const canEdit = hasPermission('sales.edit');
  const currency = company?.currency || 'USD';

  const [installments, setInstallments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [projectFilter, setProjectFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    let ignore = false;
    inventoryApiService
      .listProjects({ limit: 100 })
      .then((result) => {
        if (!ignore) setProjects(result.data);
      })
      .catch(() => {
        if (!ignore) setProjects([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listInstallments({
        search: debouncedSearch,
        status: statusFilter,
        project_id: projectFilter,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        limit: 25,
      })
      .then((result) => {
        if (ignore) return;
        setInstallments(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Installments could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, projectFilter, dateFrom, dateTo, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  function projectName(projectId) {
    return projects.find((project) => project.id === projectId)?.name || '—';
  }

  const hasFilters = Boolean(search || statusFilter || projectFilter || dateFrom || dateTo);

  return (
    <>
      <PageMeta
        title="Installments"
        description="Open and past installments with aging, balances and due dates."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Installments</h1>
            <p className="admin-page__description">
              The collection schedule across every sale. Aging is derived from the due date and the
              grace period on each plan.
            </p>
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
                placeholder="Search sale, customer or unit"
                aria-label="Search installments"
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
                <option value="">All installments</option>
                <option value="open">Open only</option>
                {installmentStatusOptions.map((option) => (
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
                  {meta.total} installment{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading installments…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Installments could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !installments.length ? (
            <EmptyState
              icon={CalendarDays}
              title="No installments found"
              description={
                hasFilters
                  ? 'Try a different search, status or date range.'
                  : 'Installment sales will appear here as their schedules are generated.'
              }
            />
          ) : null}

          {status === 'ready' && installments.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Due date</th>
                      <th scope="col">Sale</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Paid</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((installment) => (
                      <tr key={installment.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">
                              {formatDate(installment.due_date)}
                            </span>
                            <span className="admin-table__muted">
                              Installment #{installment.sequence}
                            </span>
                          </span>
                        </th>
                        <td>{installment.sale?.number || '—'}</td>
                        <td>{installment.sale?.customer?.name || '—'}</td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{installment.sale?.unit?.unit_number || '—'}</span>
                            <span className="admin-table__muted">
                              {projectName(installment.sale?.unit?.project_id)}
                            </span>
                          </span>
                        </td>
                        <td>{formatPrice(installment.amount, currency)}</td>
                        <td>{formatPrice(installment.paid_amount || 0, currency)}</td>
                        <td>
                          <span
                            className={
                              Number(installment.balance || 0) > 0 ? 'sales-balance' : undefined
                            }
                          >
                            {formatPrice(installment.balance || 0, currency)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge admin-badge--${installmentTone(
                              installment.status,
                            )}`}
                          >
                            {labelFor(installmentStatusOptions, installment.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {installment.sale ? (
                              <Link
                                className="table-action"
                                to={`/admin/sales/${installment.sale.id}`}
                              >
                                <span>View sale</span>
                              </Link>
                            ) : null}
                            {canEdit && canReschedule(installment) ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  setAction({ installment, action: 'reschedule' })
                                }
                              >
                                <CalendarClock size={15} aria-hidden="true" />
                                <span>Reschedule</span>
                              </button>
                            ) : null}
                            {canEdit && canWaive(installment) ? (
                              <button
                                type="button"
                                className="table-action table-action--danger"
                                onClick={() => setAction({ installment, action: 'waive' })}
                              >
                                <Ban size={15} aria-hidden="true" />
                                <span>Waive</span>
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
                  label="Installment pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {action ? (
        <InstallmentActionModal
          saleId={action.installment.sale_id}
          installment={action.installment}
          action={action.action}
          currency={currency}
          onClose={() => setAction(null)}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}
