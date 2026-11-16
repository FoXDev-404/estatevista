import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Banknote,
  CalendarClock,
  CircleX,
  KeyRound,
  LoaderCircle,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import ReceivePaymentModal from '../../components/admin/sales/ReceivePaymentModal';
import InstallmentActionModal from '../../components/admin/sales/InstallmentActionModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import salesApiService from '../../services/salesApiService';
import {
  canReschedule,
  canWaive,
  frequencyOptions,
  installmentStatusOptions,
  installmentTone,
  labelFor,
  lateFeeOptions,
  saleStatusOptions,
  saleTone,
  todayInput,
} from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';
import { formatDateTime } from '../../services/adminFormatters';

export default function AdminSaleDetail() {
  const { id } = useParams();
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const currency = company?.currency || 'USD';
  const canEdit = hasPermission('sales.edit');
  const canCancel = hasPermission('sales.cancel');
  const canReceive = hasPermission('collections.create');

  const [sale, setSale] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [installmentAction, setInstallmentAction] = useState(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverDate, setHandoverDate] = useState(todayInput());
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverError, setHandoverError] = useState('');
  const [handingOver, setHandingOver] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .getSale(id)
      .then((result) => {
        if (ignore) return;
        setSale(result);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'The sale could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [id, reloadKey]);

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  async function submitHandover(event) {
    event.preventDefault();
    setHandingOver(true);
    setHandoverError('');
    try {
      await salesApiService.handoverSale(sale.id, {
        handover_date: handoverDate || null,
        notes: handoverNotes || null,
      });
      addToast(`Handover recorded for ${sale.number}.`, 'success');
      setHandoverOpen(false);
      setHandoverNotes('');
      refresh();
    } catch (error) {
      setHandoverError(error.message || 'The handover could not be recorded.');
    } finally {
      setHandingOver(false);
    }
  }

  async function submitCancel() {
    setCancelling(true);
    setCancelError('');
    try {
      await salesApiService.cancelSale(sale.id, cancelReason);
      addToast(`Sale ${sale.number} was cancelled.`, 'success');
      setCancelOpen(false);
      setCancelReason('');
      refresh();
    } catch (error) {
      setCancelError(error.message || 'The sale could not be cancelled.');
    } finally {
      setCancelling(false);
    }
  }

  if (status === 'loading') {
    return (
      <Container className="admin-page">
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading sale…
        </div>
      </Container>
    );
  }

  if (status === 'error' || !sale) {
    return (
      <Container className="admin-page">
        <Link className="back-link" to="/admin/sales">
          <ArrowLeft size={14} aria-hidden="true" />
          All sales
        </Link>
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Sale could not be loaded</strong>
            <p>{loadError}</p>
          </div>
        </div>
      </Container>
    );
  }

  const balance = Number(sale.balance_due || 0);
  const cancelled = sale.status === 'cancelled';
  const plan = sale.plan;

  return (
    <>
      <PageMeta
        title={`${sale.number} · Sale`}
        description="Sale summary, installment schedule, collections and handover."
        noIndex
      />
      <Container className="admin-page">
        <Link className="back-link" to="/admin/sales">
          <ArrowLeft size={14} aria-hidden="true" />
          All sales
        </Link>

        <div className="admin-page__header admin-page__header--edit">
          <div>
            <p className="eyebrow">Sale</p>
            <div className="admin-project-detail__title">
              <h1 className="admin-page__title">{sale.number}</h1>
              <span className={`admin-badge admin-badge--${saleTone(sale.status)}`}>
                {labelFor(saleStatusOptions, sale.status)}
              </span>
              {sale.handover_date ? (
                <span className="admin-badge admin-badge--success">Handed over</span>
              ) : null}
            </div>
            <p className="admin-page__meta">
              <span>{sale.customer?.name || 'Customer'}</span>
              <span>{sale.unit?.project?.name || 'Project'}</span>
              <span>Unit {sale.unit?.unit_number || '—'}</span>
              <span>Agreement {formatDate(sale.agreement_date)}</span>
            </p>
          </div>

          <div className="admin-page__actions">
            {!cancelled && balance > 0 && canReceive ? (
              <button
                type="button"
                className="button button--primary button--md"
                onClick={() => setReceiveOpen(true)}
              >
                <Banknote size={15} aria-hidden="true" />
                Receive payment
              </button>
            ) : null}
            {!cancelled && balance <= 0 && !sale.handover_date && canEdit ? (
              <button
                type="button"
                className="button button--secondary button--md"
                onClick={() => {
                  setHandoverDate(todayInput());
                  setHandoverNotes('');
                  setHandoverError('');
                  setHandoverOpen(true);
                }}
              >
                <KeyRound size={15} aria-hidden="true" />
                Record handover
              </button>
            ) : null}
            {!cancelled && canCancel ? (
              <button
                type="button"
                className="button button--danger button--md"
                onClick={() => {
                  setCancelReason('');
                  setCancelError('');
                  setCancelOpen(true);
                }}
              >
                <CircleX size={15} aria-hidden="true" />
                Cancel sale
              </button>
            ) : null}
          </div>
        </div>

        {cancelled ? (
          <div className="admin-alert admin-alert--danger" role="status">
            <Ban size={18} aria-hidden="true" />
            <div>
              <strong>This sale is cancelled</strong>
              <p>
                Installments and commissions were cancelled and the unit was released when no other
                active contract remained.
                {sale.cancel_reason ? ` Reason: ${sale.cancel_reason}` : ''}
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
                  Money totals reconcile with the collection ledger.
                </p>
              </div>
            </div>
            <div className="admin-detail-grid">
              <div>
                <span>Customer</span>
                <strong>{sale.customer?.name || '—'}</strong>
              </div>
              <div>
                <span>Unit</span>
                <strong>
                  {sale.unit?.project?.name || '—'} · {sale.unit?.unit_number || '—'}
                </strong>
              </div>
              <div>
                <span>Salesperson</span>
                <strong>{sale.salesperson?.name || 'Unassigned'}</strong>
              </div>
              <div>
                <span>Payment type</span>
                <strong>{sale.payment_type === 'full' ? 'Full payment' : 'Installments'}</strong>
              </div>
              <div>
                <span>Sale price</span>
                <strong>{formatPrice(sale.sale_price || 0, currency)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>{formatPrice(sale.discount_amount || 0, currency)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{formatPrice(sale.tax_amount || 0, currency)}</strong>
              </div>
              <div>
                <span>Net price</span>
                <strong>{formatPrice(sale.net_price || 0, currency)}</strong>
              </div>
              <div>
                <span>Collected</span>
                <strong>{formatPrice(sale.collected_amount || 0, currency)}</strong>
              </div>
              <div>
                <span>Balance due</span>
                <strong className={balance > 0 ? 'sales-balance' : undefined}>
                  {formatPrice(balance, currency)}
                </strong>
              </div>
              <div>
                <span>Overdue</span>
                <strong className={Number(sale.overdue_amount || 0) > 0 ? 'sales-balance' : undefined}>
                  {formatPrice(sale.overdue_amount || 0, currency)}
                </strong>
              </div>
              <div>
                <span>Next due</span>
                <strong>
                  {sale.next_due
                    ? `${formatDate(sale.next_due.due_date)} · ${formatPrice(
                        sale.next_due.balance,
                        currency,
                      )}`
                    : 'Nothing open'}
                </strong>
              </div>
              <div>
                <span>Handover</span>
                <strong>{sale.handover_date ? formatDate(sale.handover_date) : 'Not handed over'}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{formatDateTime(sale.updated_at)}</strong>
              </div>
              {sale.notes ? (
                <div className="admin-detail-grid__full">
                  <span>Notes</span>
                  <strong>{sale.notes}</strong>
                </div>
              ) : null}
              {sale.handover_notes ? (
                <div className="admin-detail-grid__full">
                  <span>Handover notes</span>
                  <strong>{sale.handover_notes}</strong>
                </div>
              ) : null}
            </div>
          </section>

          {plan ? (
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">Installment plan</h2>
                  <p className="admin-panel__description">
                    The schedule is generated from these terms. Paid and waived rows stay on record.
                  </p>
                </div>
              </div>
              <div className="admin-detail-grid">
                <div>
                  <span>Down payment</span>
                  <strong>{formatPrice(plan.down_payment || 0, currency)}</strong>
                </div>
                <div>
                  <span>Installments</span>
                  <strong>{plan.number_of_installments || sale.installments.length}</strong>
                </div>
                <div>
                  <span>Frequency</span>
                  <strong>{labelFor(frequencyOptions, plan.frequency)}</strong>
                </div>
                <div>
                  <span>Plan start</span>
                  <strong>{formatDate(plan.start_date)}</strong>
                </div>
                <div>
                  <span>Due day</span>
                  <strong>{plan.due_day}</strong>
                </div>
                <div>
                  <span>Grace</span>
                  <strong>{plan.grace_days} day{Number(plan.grace_days) === 1 ? '' : 's'}</strong>
                </div>
                <div>
                  <span>Late fee</span>
                  <strong>
                    {labelFor(lateFeeOptions, plan.late_fee_type)}
                    {plan.late_fee_type !== 'none' && Number(plan.late_fee_value) > 0
                      ? ` · ${
                          plan.late_fee_type === 'percentage'
                            ? `${plan.late_fee_value}%`
                            : formatPrice(plan.late_fee_value, currency)
                        }`
                      : ''}
                  </strong>
                </div>
              </div>
            </section>
          ) : null}

          <section className="admin-panel">
            <div className="admin-panel__header admin-panel__header--wrap">
              <div>
                <h2 className="admin-panel__title">Schedule</h2>
                <p className="admin-panel__description">
                  Aging is derived from each due date and the plan grace period.
                </p>
              </div>
              {!cancelled && balance > 0 && canReceive ? (
                <div className="admin-panel__actions">
                  <button
                    type="button"
                    className="button button--secondary button--md"
                    onClick={() => setReceiveOpen(true)}
                  >
                    <Banknote size={15} aria-hidden="true" />
                    Receive payment
                  </button>
                </div>
              ) : null}
            </div>

            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Due date</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Late fee</th>
                    <th scope="col">Paid</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="admin-table__actions-head">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sale.installments.map((installment) => (
                    <tr key={installment.id}>
                      <th scope="row">#{installment.sequence}</th>
                      <td>{formatDate(installment.due_date)}</td>
                      <td>{formatPrice(installment.amount, currency)}</td>
                      <td>{formatPrice(installment.late_fee || 0, currency)}</td>
                      <td>{formatPrice(installment.paid_amount || 0, currency)}</td>
                      <td>{formatPrice(installment.balance || 0, currency)}</td>
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
                          {canEdit && canReschedule(installment) ? (
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                setInstallmentAction({
                                  installment,
                                  action: 'reschedule',
                                })
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
                              onClick={() =>
                                setInstallmentAction({
                                  installment,
                                  action: 'waive',
                                })
                              }
                            >
                              <Ban size={15} aria-hidden="true" />
                              <span>Waive</span>
                            </button>
                          ) : null}
                          {!canReschedule(installment) && !canWaive(installment) ? (
                            <span className="admin-table__muted">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </Container>

      {receiveOpen ? (
        <ReceivePaymentModal
          customerId={sale.customer_id}
          customers={sale.customer ? [sale.customer] : []}
          installments={sale.installments}
          currency={currency}
          onClose={() => setReceiveOpen(false)}
          onSaved={refresh}
        />
      ) : null}

      {installmentAction ? (
        <InstallmentActionModal
          saleId={sale.id}
          installment={installmentAction.installment}
          action={installmentAction.action}
          currency={currency}
          onClose={() => setInstallmentAction(null)}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={handoverOpen}
        onClose={() => (handingOver ? null : setHandoverOpen(false))}
        title="Record handover"
        description={`Hand the unit over to ${sale.customer?.name || 'the customer'}. The balance is clear.`}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setHandoverOpen(false)}
              disabled={handingOver}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="handover-form"
              className="button button--primary button--md"
              disabled={handingOver}
            >
              {handingOver ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {handingOver ? 'Saving…' : 'Record handover'}
            </button>
          </>
        }
      >
        <form id="handover-form" className="admin-modal-form" onSubmit={submitHandover} noValidate>
          <FormField
            label="Handover date"
            id="handover-date"
            type="date"
            value={handoverDate}
            onChange={(event) => setHandoverDate(event.target.value)}
          />
          <FormField
            label="Notes"
            id="handover-notes"
            as="textarea"
            rows="3"
            value={handoverNotes}
            onChange={(event) => setHandoverNotes(event.target.value)}
          />
          {handoverError ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <p>{handoverError}</p>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => (cancelling ? null : setCancelOpen(false))}
        title="Cancel sale"
        description={`Cancel ${sale.number}? Open installments and commissions are cancelled and the unit is released.`}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep sale
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={submitCancel}
              disabled={cancelling}
            >
              {cancelling ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {cancelling ? 'Cancelling…' : 'Cancel sale'}
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
          <>
            <FormField
              label="Reason"
              id="sale-cancel-reason"
              as="textarea"
              rows="3"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              hint="Optional, but useful for the audit trail."
            />
            <p className="admin-modal-note">
              This action cannot be undone from the workspace. The sale stays visible for reporting.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
