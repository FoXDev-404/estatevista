import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CirclePlay,
  CircleX,
  FileSignature,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import LeaseActionModal from '../../components/admin/rental/LeaseActionModal';
import RentReceiptModal from '../../components/admin/rental/RentReceiptModal';
import { useAuth } from '../../hooks/useAuth';
import rentalApiService from '../../services/rentalApiService';
import {
  canActivateLease,
  canAdjustRentSchedule,
  canRenewLease,
  canTerminateLease,
  depositHeldAmount,
  labelFor,
  labelList,
  leaseFrequencyOptions,
  leaseStatusOptions,
  leaseTone,
  rentStatusOptions,
  rentTone,
  utilityOptions,
} from '../../services/rentalSelectors';
import { formatDate, formatPrice } from '../../services/formatters';
import { formatDateTime } from '../../services/adminFormatters';

export default function AdminLeaseDetail() {
  const { id } = useParams();
  const { hasPermission, company } = useAuth();
  const currency = company?.currency || 'USD';
  const canEdit = hasPermission('leases.edit');
  const canCreate = hasPermission('leases.create');
  const canTerminate = hasPermission('leases.terminate');
  const canCollect = hasPermission('rent.collect');

  const [lease, setLease] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    rentalApiService
      .getLease(id)
      .then((result) => {
        if (ignore) return;
        setLease(result);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'The lease could not be loaded.');
        setStatus('error');
      });
    return () => {
      ignore = true;
    };
  }, [id, reloadKey]);

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  if (status === 'loading') {
    return (
      <Container className="admin-page">
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading lease…
        </div>
      </Container>
    );
  }

  if (status === 'error' || !lease) {
    return (
      <Container className="admin-page">
        <Link className="back-link" to="/admin/leases">
          <ArrowLeft size={14} aria-hidden="true" />
          All leases
        </Link>
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Lease could not be loaded</strong>
            <p>{loadError}</p>
          </div>
        </div>
      </Container>
    );
  }

  const balance = Number(lease.balance_due || 0);
  const deposit = lease.deposit;

  return (
    <>
      <PageMeta
        title={`${lease.number} · Lease`}
        description="Lease summary, rent schedule and security deposit."
        noIndex
      />
      <Container className="admin-page">
        <Link className="back-link" to="/admin/leases">
          <ArrowLeft size={14} aria-hidden="true" />
          All leases
        </Link>

        <div className="admin-page__header admin-page__header--edit">
          <div>
            <p className="eyebrow">Lease</p>
            <div className="admin-project-detail__title">
              <h1 className="admin-page__title">{lease.number}</h1>
              <span className={`admin-badge admin-badge--${leaseTone(lease.status)}`}>
                {labelFor(leaseStatusOptions, lease.status)}
              </span>
              {lease.next_lease ? (
                <span className="admin-badge admin-badge--muted">
                  Renewed by {lease.next_lease.number}
                </span>
              ) : null}
            </div>
            <p className="admin-page__meta">
              <span>{lease.tenant?.name || 'Tenant'}</span>
              <span>{lease.unit?.project?.name || 'Project'}</span>
              <span>Unit {lease.unit?.unit_number || '—'}</span>
              <span>
                {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
              </span>
            </p>
          </div>

          <div className="admin-page__actions">
            {canActivateLease(lease) && canEdit ? (
              <button
                type="button"
                className="button button--primary button--md"
                onClick={() => setAction({ action: 'activate' })}
              >
                <CirclePlay size={15} aria-hidden="true" />
                Activate lease
              </button>
            ) : null}
            {canRenewLease(lease) && canCreate ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => setAction({ action: 'renew' })}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Renew
              </button>
            ) : null}
            {canRenewLease(lease) && canEdit ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => setAction({ action: 'revise' })}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                Revise rent
              </button>
            ) : null}
            {Number(lease.balance_due || 0) > 0 && canCollect && lease.status === 'active' ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => setReceiveOpen(true)}
              >
                <Banknote size={15} aria-hidden="true" />
                Receive rent
              </button>
            ) : null}
            {canTerminateLease(lease) && canTerminate ? (
              <button
                type="button"
                className="button button--danger button--md"
                onClick={() => setAction({ action: 'terminate' })}
              >
                <CircleX size={15} aria-hidden="true" />
                Terminate
              </button>
            ) : null}
          </div>
        </div>

        {lease.status === 'terminated' ? (
          <div className="admin-alert admin-alert--danger" role="status">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>This lease is terminated</strong>
              <p>
                Future unpaid rent was cancelled and the unit was released when no other active
                contract remained.
                {lease.termination_reason ? ` Reason: ${lease.termination_reason}` : ''}
              </p>
            </div>
          </div>
        ) : null}

        <div className="sales-detail">
          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h2 className="admin-panel__title">Summary</h2>
                <p className="admin-panel__description">
                  Rent, collections and the deposit reconcile with the schedule below.
                </p>
              </div>
            </div>
            <div className="admin-detail-grid">
              <div>
                <span>Tenant</span>
                <strong>{lease.tenant?.name || '—'}</strong>
              </div>
              <div>
                <span>Unit</span>
                <strong>
                  {lease.unit?.project?.name || '—'} · {lease.unit?.unit_number || '—'}
                </strong>
              </div>
              <div>
                <span>Frequency</span>
                <strong>{labelFor(leaseFrequencyOptions, lease.frequency)}</strong>
              </div>
              <div>
                <span>Rent</span>
                <strong>{formatPrice(lease.rent_amount || 0, currency)}</strong>
              </div>
              <div>
                <span>Due day</span>
                <strong>{lease.due_day}</strong>
              </div>
              <div>
                <span>Grace</span>
                <strong>
                  {lease.grace_days} day{Number(lease.grace_days) === 1 ? '' : 's'}
                </strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatPrice(lease.collected || 0, currency)}</strong>
              </div>
              <div>
                <span>Balance due</span>
                <strong className={balance > 0 ? 'sales-balance' : undefined}>
                  {formatPrice(balance, currency)}
                </strong>
              </div>
              <div>
                <span>Overdue</span>
                <strong
                  className={Number(lease.overdue_amount || 0) > 0 ? 'sales-balance' : undefined}
                >
                  {formatPrice(lease.overdue_amount || 0, currency)}
                </strong>
              </div>
              <div>
                <span>Next due</span>
                <strong>
                  {lease.next_due
                    ? `${formatDate(lease.next_due.due_date)} · ${formatPrice(
                        lease.next_due.balance,
                        currency,
                      )}`
                    : 'Nothing open'}
                </strong>
              </div>
              <div>
                <span>Days remaining</span>
                <strong>
                  {Number(lease.days_remaining || 0) >= 0
                    ? `${lease.days_remaining} day${Number(lease.days_remaining) === 1 ? '' : 's'}`
                    : 'Ended'}
                </strong>
              </div>
              <div>
                <span>Utilities</span>
                <strong>{labelList(utilityOptions, lease.utilities_included)}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{formatDateTime(lease.updated_at)}</strong>
              </div>
              {lease.terms ? (
                <div className="admin-detail-grid__full">
                  <span>Terms</span>
                  <strong>{lease.terms}</strong>
                </div>
              ) : null}
            </div>
          </section>

          {deposit ? (
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">Security deposit</h2>
                  <p className="admin-panel__description">
                    Receipts, deductions and refunds are recorded against the lease.
                  </p>
                </div>
                {hasPermission('deposits.view') ? (
                  <div className="admin-panel__actions">
                    <Link className="button button--secondary button--md" to="/admin/deposits">
                      Open deposits
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className="admin-detail-grid">
                <div>
                  <span>Status</span>
                  <strong>{labelFor(
                    [
                      { value: 'to_collect', label: 'To collect' },
                      { value: 'held', label: 'Held' },
                      { value: 'awaiting_settlement', label: 'Awaiting settlement' },
                      { value: 'settled', label: 'Settled' },
                    ],
                    deposit.status,
                  )}</strong>
                </div>
                <div>
                  <span>Required</span>
                  <strong>{formatPrice(deposit.required_amount || 0, currency)}</strong>
                </div>
                <div>
                  <span>Received</span>
                  <strong>{formatPrice(deposit.received_amount || 0, currency)}</strong>
                </div>
                <div>
                  <span>Held</span>
                  <strong>{formatPrice(depositHeldAmount(deposit), currency)}</strong>
                </div>
                <div>
                  <span>Deducted</span>
                  <strong>{formatPrice(deposit.deducted_amount || 0, currency)}</strong>
                </div>
                <div>
                  <span>Refunded</span>
                  <strong>{formatPrice(deposit.refunded_amount || 0, currency)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <section className="admin-panel">
            <div className="admin-panel__header admin-panel__header--wrap">
              <div>
                <h2 className="admin-panel__title">Rent schedule</h2>
                <p className="admin-panel__description">
                  Aging comes from each due date and the lease grace period.
                </p>
              </div>
              {balance > 0 && canCollect && lease.status === 'active' ? (
                <div className="admin-panel__actions">
                  <button
                    type="button"
                    className="button button--secondary button--md"
                    onClick={() => setReceiveOpen(true)}
                  >
                    <Banknote size={15} aria-hidden="true" />
                    Receive rent
                  </button>
                </div>
              ) : null}
            </div>

            {!lease.schedules.length ? (
              <p className="admin-modal-note">
                The schedule is empty. Activate the lease to generate rent periods.
              </p>
            ) : (
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Covers</th>
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
                    {lease.schedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <th scope="row">{schedule.period_label}</th>
                        <td>
                          <span className="admin-table__stack">
                            <span>{formatDate(schedule.period_start)}</span>
                            <span className="admin-table__muted">
                              to {formatDate(schedule.period_end)}
                            </span>
                          </span>
                        </td>
                        <td>{formatDate(schedule.due_date)}</td>
                        <td>{formatPrice(schedule.rent_amount || 0, currency)}</td>
                        <td>{formatPrice(schedule.adjustments || 0, currency)}</td>
                        <td>{formatPrice(schedule.paid_amount || 0, currency)}</td>
                        <td>{formatPrice(schedule.balance || 0, currency)}</td>
                        <td>
                          <span className={`admin-badge admin-badge--${rentTone(schedule.status)}`}>
                            {labelFor(rentStatusOptions, schedule.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            {canEdit && canAdjustRentSchedule(schedule) ? (
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => setAction({ action: 'adjust', schedule })}
                              >
                                <CalendarClock size={15} aria-hidden="true" />
                                <span>Adjust</span>
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
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <h2 className="admin-panel__title">Deposit history</h2>
                <p className="admin-panel__description">
                  Every deposit movement is kept for the audit trail.
                </p>
              </div>
            </div>
            {!deposit?.transactions?.length ? (
              <p className="admin-modal-note">No deposit movements recorded yet.</p>
            ) : (
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
                    {deposit.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <th scope="row">{transaction.type}</th>
                        <td>{formatPrice(transaction.amount || 0, currency)}</td>
                        <td>{transaction.reason || '—'}</td>
                        <td>{formatDateTime(transaction.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Container>

      {action ? (
        <LeaseActionModal
          lease={lease}
          schedule={action.schedule || null}
          action={action.action}
          currency={currency}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null);
            refresh();
          }}
        />
      ) : null}

      {receiveOpen ? (
        <RentReceiptModal
          leaseId={lease.id}
          tenantId={lease.tenant_id}
          tenantName={lease.tenant?.name}
          currency={currency}
          onClose={() => setReceiveOpen(false)}
          onSaved={() => {
            setReceiveOpen(false);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
