import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  CircleX,
  LoaderCircle,
  Plus,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Pagination from '../../components/properties/Pagination';
import ReservationFormModal from '../../components/admin/sales/ReservationFormModal';
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
  reservationStatusOptions,
  reservationTone,
} from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';

export default function AdminReservations() {
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const canCreate = hasPermission('reservations.create');
  const canCancel = hasPermission('reservations.cancel');
  const canCreateSale = hasPermission('sales.create');
  const currency = company?.currency || 'USD';

  const [reservations, setReservations] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [lookups, setLookups] = useState({
    customers: [],
    units: [],
    projects: [],
    users: [],
  });
  const [formOpen, setFormOpen] = useState(false);
  const [salePrefill, setSalePrefill] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

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
      .listReservations({
        search: debouncedSearch,
        status: statusFilter,
        project_id: projectFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setReservations(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Reservations could not be loaded.');
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

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');
    try {
      await salesApiService.cancelReservation(cancelTarget.id, cancelReason);
      addToast(`Reservation ${cancelTarget.number} was cancelled.`, 'success');
      setCancelTarget(null);
      setCancelReason('');
      refresh();
    } catch (error) {
      setCancelError(error.message || 'The reservation could not be cancelled.');
    } finally {
      setCancelling(false);
    }
  }

  const hasFilters = Boolean(search || statusFilter || projectFilter);
  const availableUnits = lookups.units.filter((unit) => unit.status === 'available');

  return (
    <>
      <PageMeta
        title="Reservations"
        description="Hold units for customers until the reservation expires or converts."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Reservations</h1>
            <p className="admin-page__description">
              A reservation holds an available unit for a customer. Convert it to a sale, cancel it
              or let it expire automatically on the expiry date.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Add reservation
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
                aria-label="Search reservations"
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
                {reservationStatusOptions.map((option) => (
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
                  {meta.total} reservation{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading reservations…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Reservations could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !reservations.length ? (
            <EmptyState
              icon={CalendarCheck}
              title="No reservations found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Reserve an available unit to hold it for a customer.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setFormOpen(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add reservation
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && reservations.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Reservation</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Booking amount</th>
                      <th scope="col">Expires</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((reservation) => (
                      <tr key={reservation.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{reservation.number}</span>
                            <span className="admin-table__muted">
                              Reserved {formatDate(reservation.reserved_on)}
                            </span>
                          </span>
                        </th>
                        <td>{reservation.customer?.name || '—'}</td>
                        <td>
                          <span className="admin-table__stack">
                            <span>{reservation.unit?.unit_number || '—'}</span>
                            <span className="admin-table__muted">
                              {reservation.unit?.project?.name || ''}
                            </span>
                          </span>
                        </td>
                        <td>{formatPrice(reservation.booking_amount || 0, currency)}</td>
                        <td>{formatDate(reservation.expires_at)}</td>
                        <td>
                          <span
                            className={`admin-badge admin-badge--${reservationTone(
                              reservation.status,
                            )}`}
                          >
                            {labelFor(reservationStatusOptions, reservation.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {reservation.status === 'active' && canCreateSale ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() =>
                                  setSalePrefill({ source: 'reservation', record: reservation })
                                }
                              >
                                <ShoppingCart size={15} aria-hidden="true" />
                                <span>Create sale</span>
                              </button>
                            ) : null}
                            {reservation.status === 'active' && canCancel ? (
                              <button
                                type="button"
                                className="table-action table-action--danger"
                                onClick={() => {
                                  setCancelReason('');
                                  setCancelError('');
                                  setCancelTarget(reservation);
                                }}
                              >
                                <CircleX size={15} aria-hidden="true" />
                                <span>Cancel</span>
                              </button>
                            ) : null}
                            {reservation.converted_sale ? (
                              <Link
                                className="table-action"
                                to={`/admin/sales/${reservation.converted_sale.id}`}
                              >
                                <span>View {reservation.converted_sale.number}</span>
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
                  label="Reservation pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {formOpen ? (
        <ReservationFormModal
          customers={lookups.customers}
          units={availableUnits}
          onClose={() => setFormOpen(false)}
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
        open={Boolean(cancelTarget)}
        onClose={() => (cancelling ? null : setCancelTarget(null))}
        title="Cancel reservation"
        description={
          cancelTarget
            ? `Cancel ${cancelTarget.number}? The unit returns to the available pool.`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Keep reservation
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmCancel}
              disabled={cancelling}
            >
              {cancelling ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {cancelling ? 'Cancelling…' : 'Cancel reservation'}
            </button>
          </>
        }
      >
        {cancelError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{cancelError}</p>
          </div>
        ) : (
          <FormField
            label="Reason"
            id="reservation-cancel-reason"
            as="textarea"
            rows="3"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            hint="Optional. The reason is added to the reservation notes."
          />
        )}
      </Modal>
    </>
  );
}
