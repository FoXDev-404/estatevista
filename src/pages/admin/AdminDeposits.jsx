import { useEffect, useState } from 'react';
import {
  AlertCircle,
  History,
  LoaderCircle,
  MinusCircle,
  PlusCircle,
  Search,
  ShieldCheck,
  Undo2,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import DepositActionModal from '../../components/admin/rental/DepositActionModal';
import { useAuth } from '../../hooks/useAuth';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import rentalApiService from '../../services/rentalApiService';
import {
  depositHeldAmount,
  depositStatusOptions,
  depositTone,
  labelFor,
} from '../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../services/formatters';
import { formatDateTime } from '../../services/adminFormatters';

const TYPE_LABELS = {
  receipt: 'Received',
  deduction: 'Deducted',
  refund: 'Refunded',
};

export default function AdminDeposits() {
  const { hasPermission, company } = useAuth();
  const canManage = hasPermission('deposits.manage');
  const currency = company?.currency || 'USD';

  const [deposits, setDeposits] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [action, setAction] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  useEffect(() => {
    let ignore = false;

    rentalApiService
      .listDeposits({
        search: debouncedSearch,
        status: statusFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setDeposits(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Security deposits could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  const hasFilters = Boolean(search || statusFilter);

  return (
    <>
      <PageMeta
        title="Security deposits"
        description="Deposits received, held, deducted and refunded."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Rental</p>
            <h1 className="admin-page__title">Security deposits</h1>
            <p className="admin-page__description">
              Track the deposit required for each lease, what is held today, and every deduction
              or refund recorded against it.
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
                placeholder="Search lease, tenant or unit"
                aria-label="Search security deposits"
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
                aria-label="Filter by deposit status"
              >
                <option value="">All statuses</option>
                {depositStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} deposit{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading security deposits…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Security deposits could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !deposits.length ? (
            <EmptyState
              icon={ShieldCheck}
              title="No security deposits found"
              description={
                hasFilters
                  ? 'Try a different search or status.'
                  : 'Create a lease with a security deposit to track it here.'
              }
            />
          ) : null}

          {status === 'ready' && deposits.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Lease</th>
                      <th scope="col">Tenant</th>
                      <th scope="col">Unit</th>
                      <th scope="col">Required</th>
                      <th scope="col">Received</th>
                      <th scope="col">Held</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((deposit) => {
                      const held = depositHeldAmount(deposit);
                      const required = Number(deposit.required_amount || 0);
                      const received = Number(deposit.received_amount || 0);
                      return (
                        <tr key={deposit.id}>
                          <th scope="row">
                            <span className="admin-table__stack">
                              <span className="admin-table__title">
                                {deposit.lease?.number || '—'}
                              </span>
                              <span className="admin-table__muted">
                                {deposit.lease?.start_date
                                  ? `${formatDate(deposit.lease.start_date)} → ${formatDate(
                                      deposit.lease.end_date,
                                    )}`
                                  : 'Lease dates not available'}
                              </span>
                            </span>
                          </th>
                          <td>{deposit.lease?.tenant?.name || '—'}</td>
                          <td>
                            <span className="admin-table__stack">
                              <span>{deposit.lease?.unit?.unit_number || '—'}</span>
                              <span className="admin-table__muted">
                                {deposit.lease?.unit?.project?.name || ''}
                              </span>
                            </span>
                          </td>
                          <td>{formatPrice(required, currency)}</td>
                          <td>{formatPrice(received, currency)}</td>
                          <td>
                            <span className={held > 0 ? undefined : 'admin-table__muted'}>
                              {formatPrice(held, currency)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`admin-badge admin-badge--${depositTone(deposit.status)}`}
                            >
                              {labelFor(depositStatusOptions, deposit.status)}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {canManage && held > 0 ? (
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() => setAction({ deposit, type: 'deduction' })}
                                >
                                  <MinusCircle size={15} aria-hidden="true" />
                                  <span>Deduct</span>
                                </button>
                              ) : null}
                              {canManage && held > 0 ? (
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() => setAction({ deposit, type: 'refund' })}
                                >
                                  <Undo2 size={15} aria-hidden="true" />
                                  <span>Refund</span>
                                </button>
                              ) : null}
                              {canManage &&
                              ['to_collect', 'held'].includes(deposit.status) &&
                              received < required ? (
                                <button
                                  type="button"
                                  className="table-action"
                                  onClick={() => setAction({ deposit, type: 'receipt' })}
                                >
                                  <PlusCircle size={15} aria-hidden="true" />
                                  <span>Receive</span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => setHistoryTarget(deposit)}
                              >
                                <History size={15} aria-hidden="true" />
                                <span>History</span>
                              </button>
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
                  label="Security deposit pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {action ? (
        <DepositActionModal
          deposit={action.deposit}
          action={action.type}
          currency={currency}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            refresh();
          }}
        />
      ) : null}

      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title={
          historyTarget
            ? `Deposit history · ${historyTarget.lease?.number || 'Lease'}`
            : 'Deposit history'
        }
        description={
          historyTarget
            ? `${historyTarget.lease?.tenant?.name || 'Tenant'} · ${formatPrice(
                depositHeldAmount(historyTarget),
                currency,
              )} held`
            : ''
        }
        size="large"
        footer={
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={() => setHistoryTarget(null)}
          >
            Close
          </button>
        }
      >
        {historyTarget ? (
          (historyTarget.transactions || []).length ? (
            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyTarget.transactions || []).map((transaction) => (
                    <tr key={transaction.id}>
                      <th scope="row">{TYPE_LABELS[transaction.type] || transaction.type}</th>
                      <td>{formatPrice(transaction.amount || 0, currency)}</td>
                      <td>{transaction.reason || '—'}</td>
                      <td>{formatDateTime(transaction.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-modal-note">No deposit movements recorded yet.</p>
          )
        ) : null}
      </Modal>
    </>
  );
}
