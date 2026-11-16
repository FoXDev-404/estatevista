import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Handshake,
  LoaderCircle,
  Plus,
  Search,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/properties/Pagination';
import SaleFormModal from '../../components/admin/sales/SaleFormModal';
import { useAuth } from '../../hooks/useAuth';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import crmApiService from '../../services/crmApiService';
import inventoryApiService from '../../services/inventoryApiService';
import salesApiService from '../../services/salesApiService';
import { labelFor, saleStatusOptions, saleTone } from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminSales() {
  const { hasPermission, company } = useAuth();
  const navigate = useNavigate();
  const canCreate = hasPermission('sales.create');
  const canViewCollections = hasPermission('collections.view');
  const currency = company?.currency || 'USD';

  const [sales, setSales] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [salespersonFilter, setSalespersonFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [lookups, setLookups] = useState({
    customers: [],
    units: [],
    projects: [],
    users: [],
  });
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      crmApiService.listCustomers({ limit: 100 }),
      inventoryApiService.listUnits({ limit: 100 }),
      inventoryApiService.listProjects({ limit: 100 }),
      adminApiService.getLookups(),
    ])
      .then(([customerResult, unitResult, projectResult, lookupData]) => {
        if (ignore) return;
        setLookups({
          customers: customerResult.data,
          units: unitResult.data,
          projects: projectResult.data,
          users: lookupData.users || [],
        });
      })
      .catch(() => {
        if (!ignore) {
          setLookups({ customers: [], units: [], projects: [], users: [] });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listSales({
        search: debouncedSearch,
        status: statusFilter,
        project_id: projectFilter,
        salesperson_id: salespersonFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setSales(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Sales could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, projectFilter, salespersonFilter, page]);

  function resetPage() {
    setPage(1);
  }

  const hasFilters = Boolean(search || statusFilter || projectFilter || salespersonFilter);
  const sellableUnits = lookups.units.filter((unit) =>
    ['available', 'reserved'].includes(unit.status),
  );

  return (
    <>
      <PageMeta
        title="Sales"
        description="Sale agreements, installment schedules and balances."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Sales</h1>
            <p className="admin-page__description">
              Record full-payment and installment sales. Each agreement marks the unit sold and
              generates a collection schedule automatically.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Add sale
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
                aria-label="Search sales"
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
                {saleStatusOptions.map((option) => (
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
              <select
                value={salespersonFilter}
                onChange={(event) => {
                  setSalespersonFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by salesperson"
              >
                <option value="">Everyone</option>
                {lookups.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} sale{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading sales…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Sales could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !sales.length ? (
            <EmptyState
              icon={Handshake}
              title="No sales found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Create a sale manually or convert an accepted quotation or reservation.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add sale
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && sales.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Sale</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Net price</th>
                      <th scope="col">Collected</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{sale.number}</span>
                            <span className="admin-table__muted">
                              {formatDate(sale.agreement_date)} ·{' '}
                              {sale.payment_type === 'full' ? 'Full payment' : 'Installments'}
                            </span>
                          </span>
                        </th>
                        <td>{sale.customer?.name || '—'}</td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{sale.unit?.unit_number || '—'}</span>
                            <span className="admin-table__muted">
                              {sale.unit?.project?.name || ''}
                            </span>
                          </span>
                        </td>
                        <td>{formatPrice(sale.net_price || 0, currency)}</td>
                        <td>{formatPrice(sale.collected_amount || 0, currency)}</td>
                        <td>
                          <span
                            className={
                              Number(sale.balance_due || 0) > 0 ? 'sales-balance' : undefined
                            }
                          >
                            {formatPrice(sale.balance_due || 0, currency)}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge--${saleTone(sale.status)}`}>
                            {labelFor(saleStatusOptions, sale.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link className="table-action" to={`/admin/sales/${sale.id}`}>
                              <span>View sale</span>
                            </Link>
                            {canViewCollections && Number(sale.balance_due || 0) > 0 ? (
                              <Link
                                className="table-action"
                                to={`/admin/collections?customer=${sale.customer_id}`}
                              >
                                <span>Collect</span>
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
                  label="Sale pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {formOpen ? (
        <SaleFormModal
          customers={lookups.customers}
          units={sellableUnits}
          users={lookups.users}
          currency={currency}
          onClose={() => setFormOpen(false)}
          onSaved={(sale) => navigate(`/admin/sales/${sale.id}`)}
        />
      ) : null}
    </>
  );
}
