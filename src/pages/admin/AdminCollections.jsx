import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  LoaderCircle,
  Plus,
  Receipt,
  Search,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Pagination from '../../components/properties/Pagination';
import ReceivePaymentModal from '../../components/admin/sales/ReceivePaymentModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import crmApiService from '../../services/crmApiService';
import salesApiService from '../../services/salesApiService';
import { labelFor, receiptTone } from '../../services/salesSelectors';
import { formatDate, formatPrice } from '../../services/formatters';
import { formatDateTime } from '../../services/adminFormatters';

const receiptStatusOptions = [
  { value: 'completed', label: 'Completed' },
  { value: 'voided', label: 'Voided' },
];

export default function AdminCollections() {
  const [searchParams] = useSearchParams();
  const customerParam = searchParams.get('customer') || '';
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('collections.create');
  const canVoid = hasPermission('collections.void');
  const currency = company?.currency || 'USD';

  const [receipts, setReceipts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState(customerParam);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [customers, setCustomers] = useState([]);
  const [receiveOpen, setReceiveOpen] = useState(Boolean(customerParam));
  const [receiveCustomer, setReceiveCustomer] = useState(customerParam);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    let ignore = false;
    crmApiService
      .listCustomers({ limit: 100 })
      .then((result) => {
        if (!ignore) setCustomers(result.data);
      })
      .catch(() => {
        if (!ignore) setCustomers([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listCollections({
        search: debouncedSearch,
        customer_id: customerFilter,
        status: statusFilter,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setReceipts(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Receipts could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, customerFilter, statusFilter, dateFrom, dateTo, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    setVoiding(true);
    setVoidError('');
    try {
      await salesApiService.voidCollection(voidTarget.id, voidReason.trim());
      addToast(`Receipt ${voidTarget.number} was voided.`, 'success');
      setVoidTarget(null);
      setVoidReason('');
      refresh();
    } catch (error) {
      setVoidError(error.message || 'The receipt could not be voided.');
    } finally {
      setVoiding(false);
    }
  }

  const hasFilters = Boolean(
    search || customerFilter || statusFilter || dateFrom || dateTo,
  );

  return (
    <>
      <PageMeta
        title="Collections"
        description="Receipts, allocations and voided payments."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Collections</h1>
            <p className="admin-page__description">
              Record money received and allocate it to one or more installments. Voiding a receipt
              reopens the affected balances.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => {
                setReceiveCustomer('');
                setReceiveOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Receive payment
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
                placeholder="Search receipt, customer or reference"
                aria-label="Search receipts"
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
                value={customerFilter}
                onChange={(event) => {
                  setCustomerFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by customer"
              >
                <option value="">All customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
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
                {receiptStatusOptions.map((option) => (
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
                aria-label="Received from"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  resetPage();
                }}
                aria-label="Received to"
              />
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} receipt{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading receipts…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Receipts could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !receipts.length ? (
            <EmptyState
              icon={Receipt}
              title="No receipts found"
              description={
                hasFilters
                  ? 'Try a different search, customer or date range.'
                  : 'Record a payment against an open installment to create the first receipt.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => {
                      setReceiveCustomer('');
                      setReceiveOpen(true);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Receive payment
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && receipts.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Receipt</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Received</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Settles</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <th scope="row">
                          <span className="admin-table__stack">
                            <span className="admin-table__title">{receipt.number}</span>
                            <span className="admin-table__muted">
                              {receipt.reference || 'No reference'}
                            </span>
                          </span>
                        </th>
                        <td>{receipt.customer?.name || '—'}</td>
                        <td>{formatDate(receipt.received_on)}</td>
                        <td>{formatPrice(receipt.amount || 0, currency)}</td>
                        <td>{receipt.settles || '—'}</td>
                        <td>
                          <span
                            className={`admin-badge admin-badge--${receiptTone(receipt.status)}`}
                          >
                            {labelFor(receiptStatusOptions, receipt.status)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => setViewReceipt(receipt)}
                            >
                              <span>View</span>
                            </button>
                            {canVoid && receipt.status === 'completed' ? (
                              <button
                                type="button"
                                className="table-action table-action--danger"
                                onClick={() => {
                                  setVoidReason('');
                                  setVoidError('');
                                  setVoidTarget(receipt);
                                }}
                              >
                                <Ban size={15} aria-hidden="true" />
                                <span>Void</span>
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
                  label="Receipt pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {receiveOpen ? (
        <ReceivePaymentModal
          customerId={receiveCustomer}
          customers={customers}
          currency={currency}
          onClose={() => setReceiveOpen(false)}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={Boolean(viewReceipt)}
        onClose={() => setViewReceipt(null)}
        title={viewReceipt ? `Receipt ${viewReceipt.number}` : 'Receipt'}
        description={
          viewReceipt
            ? `${viewReceipt.customer?.name || 'Customer'} · ${formatPrice(
                viewReceipt.amount,
                currency,
              )} received ${formatDate(viewReceipt.received_on)}`
            : ''
        }
        size="large"
        footer={
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={() => setViewReceipt(null)}
          >
            Close
          </button>
        }
      >
        {viewReceipt ? (
          <>
            <div className="admin-detail-grid">
              <div>
                <span>Status</span>
                <strong>
                  <span className={`admin-badge admin-badge--${receiptTone(viewReceipt.status)}`}>
                    {labelFor(receiptStatusOptions, viewReceipt.status)}
                  </span>
                </strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{viewReceipt.reference || '—'}</strong>
              </div>
              <div>
                <span>Recorded</span>
                <strong>{formatDateTime(viewReceipt.created_at)}</strong>
              </div>
              {viewReceipt.status === 'voided' ? (
                <div>
                  <span>Voided</span>
                  <strong>
                    {formatDateTime(viewReceipt.voided_at)}
                    {viewReceipt.void_reason ? ` · ${viewReceipt.void_reason}` : ''}
                  </strong>
                </div>
              ) : null}
              {viewReceipt.notes ? (
                <div className="admin-detail-grid__full">
                  <span>Notes</span>
                  <strong>{viewReceipt.notes}</strong>
                </div>
              ) : null}
            </div>

            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Sale</th>
                    <th scope="col">Installment</th>
                    <th scope="col">Due date</th>
                    <th scope="col">Amount allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewReceipt.allocations || []).map((allocation) => (
                    <tr key={allocation.id}>
                      <td>{allocation.sale?.number || '—'}</td>
                      <td>
                        {allocation.installment
                          ? `#${allocation.installment.sequence}`
                          : 'Unallocated'}
                      </td>
                      <td>
                        {allocation.installment
                          ? formatDate(allocation.installment.due_date)
                          : '—'}
                      </td>
                      <td>{formatPrice(allocation.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(voidTarget)}
        onClose={() => (voiding ? null : setVoidTarget(null))}
        title="Void receipt"
        description={
          voidTarget
            ? `Void ${voidTarget.number}? The allocated installment balances reopen.`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setVoidTarget(null)}
              disabled={voiding}
            >
              Keep receipt
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmVoid}
              disabled={voiding || !voidReason.trim()}
            >
              {voiding ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {voiding ? 'Voiding…' : 'Void receipt'}
            </button>
          </>
        }
      >
        {voidError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{voidError}</p>
          </div>
        ) : (
          <FormField
            label="Reason"
            id="receipt-void-reason"
            as="textarea"
            rows="3"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            required
            hint="Required. The receipt stays on record as voided."
          />
        )}
      </Modal>
    </>
  );
}
