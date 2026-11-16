import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  Banknote,
  Check,
  LoaderCircle,
  Percent,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import CommissionRuleModal from '../../components/admin/sales/CommissionRuleModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import salesApiService from '../../services/salesApiService';
import {
  commissionStatusOptions,
  commissionTone,
  commissionTriggerOptions,
  labelFor,
} from '../../services/salesSelectors';
import { formatPrice } from '../../services/formatters';

const TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'ledger', label: 'Ledger' },
];

export default function AdminCommissions() {
  const { hasPermission, company } = useAuth();
  const { addToast } = useToast();
  const canManage = hasPermission('commissions.manage');
  const currency = company?.currency || 'USD';

  const [tab, setTab] = useState('rules');
  const [projects, setProjects] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);
  const [users, setUsers] = useState([]);

  const [rules, setRules] = useState([]);
  const [rulesStatus, setRulesStatus] = useState('loading');
  const [rulesError, setRulesError] = useState('');

  const [commissions, setCommissions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [ledgerStatus, setLedgerStatus] = useState('loading');
  const [ledgerError, setLedgerError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [salespersonFilter, setSalespersonFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState('');

  const [ruleForm, setRuleForm] = useState({ open: false, rule: null });
  const [ruleDelete, setRuleDelete] = useState(null);
  const [deletingRule, setDeletingRule] = useState(false);
  const [ruleDeleteError, setRuleDeleteError] = useState('');
  const [commissionCancel, setCommissionCancel] = useState(null);
  const [cancellingCommission, setCancellingCommission] = useState(false);
  const [commissionCancelError, setCommissionCancelError] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      inventoryApiService.listProjects({ limit: 100 }),
      adminApiService.getLookups(),
    ])
      .then(([projectResult, lookupData]) => {
        if (ignore) return;
        setProjects(projectResult.data);
        setUnitTypes(lookupData.unit_types || []);
        setUsers(lookupData.users || []);
      })
      .catch(() => {
        if (!ignore) {
          setProjects([]);
          setUnitTypes([]);
          setUsers([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listCommissionRules()
      .then((rows) => {
        if (ignore) return;
        setRules(rows);
        setRulesError('');
        setRulesStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setRulesError(error.message || 'Commission rules could not be loaded.');
        setRulesStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let ignore = false;

    salesApiService
      .listCommissions({
        search: debouncedSearch,
        status: statusFilter,
        salesperson_id: salespersonFilter,
        page,
        limit: 20,
      })
      .then((result) => {
        if (ignore) return;
        setCommissions(result.data);
        setMeta(result.meta);
        setLedgerError('');
        setLedgerStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLedgerError(error.message || 'Commission entries could not be loaded.');
        setLedgerStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, salespersonFilter, page, reloadKey]);

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  function ruleTarget(rule) {
    if (rule.applicability === 'project') {
      return projects.find((project) => project.id === rule.project_id)?.name || 'Project';
    }
    if (rule.applicability === 'unit_type') {
      return unitTypes.find((unitType) => unitType.id === rule.unit_type_id)?.name || 'Unit type';
    }
    return 'All sales';
  }

  function ruleRate(rule) {
    return rule.rate_type === 'percentage'
      ? `${rule.rate_value}%`
      : formatPrice(rule.rate_value, currency);
  }

  async function toggleRule(rule) {
    setBusyId(rule.id);
    try {
      await salesApiService.updateCommissionRule(rule.id, { is_active: !rule.is_active });
      addToast(
        `Commission rule ${rule.name} ${rule.is_active ? 'deactivated' : 'activated'}.`,
        'success',
      );
      refresh();
    } catch (error) {
      addToast(error.message || 'The commission rule could not be updated.', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function confirmDeleteRule() {
    if (!ruleDelete) return;
    setDeletingRule(true);
    setRuleDeleteError('');
    try {
      await salesApiService.deleteCommissionRule(ruleDelete.id);
      addToast(`Commission rule ${ruleDelete.name} was deleted.`, 'success');
      setRuleDelete(null);
      refresh();
    } catch (error) {
      setRuleDeleteError(error.message || 'The commission rule could not be deleted.');
    } finally {
      setDeletingRule(false);
    }
  }

  async function changeCommission(entry, nextStatus) {
    setBusyId(entry.id);
    try {
      await salesApiService.updateCommission(entry.id, nextStatus);
      addToast(
        `Commission for ${entry.sale?.number || 'sale'} marked ${labelFor(
          commissionStatusOptions,
          nextStatus,
        ).toLowerCase()}.`,
        'success',
      );
      refresh();
    } catch (error) {
      addToast(error.message || 'The commission could not be updated.', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function confirmCancelCommission() {
    if (!commissionCancel) return;
    setCancellingCommission(true);
    setCommissionCancelError('');
    try {
      await salesApiService.updateCommission(commissionCancel.id, 'cancelled');
      addToast(`Commission for ${commissionCancel.sale?.number || 'sale'} was cancelled.`, 'success');
      setCommissionCancel(null);
      refresh();
    } catch (error) {
      setCommissionCancelError(error.message || 'The commission could not be cancelled.');
    } finally {
      setCancellingCommission(false);
    }
  }

  const hasLedgerFilters = Boolean(search || statusFilter || salespersonFilter);

  return (
    <>
      <PageMeta
        title="Commissions"
        description="Commission rules and salesperson ledger."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Commissions</h1>
            <p className="admin-page__description">
              Rules decide the rate and when commission becomes payable. The ledger is generated
              per sale when a salesperson and a matching rule exist.
            </p>
          </div>
          {tab === 'rules' && canManage ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setRuleForm({ open: true, rule: null })}
            >
              <Plus size={16} aria-hidden="true" />
              Add commission rule
            </button>
          ) : null}
        </div>

        <div className="admin-panel">
          <div className="admin-tabs" role="tablist" aria-label="Commission sections">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`admin-tab${tab === entry.id ? ' is-active' : ''}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
                {entry.id === 'rules' ? ` (${rules.length})` : null}
                {entry.id === 'ledger' && meta ? ` (${meta.total})` : null}
              </button>
            ))}
          </div>

          {tab === 'rules' ? (
            <>
              <div className="admin-toolbar">
                <div className="admin-toolbar__filters">
                  <span className="admin-toolbar__count">
                    {rules.length} rule{rules.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {rulesStatus === 'loading' ? (
                <div className="admin-loading" role="status">
                  <LoaderCircle size={20} className="spin" aria-hidden="true" />
                  Loading commission rules…
                </div>
              ) : null}

              {rulesStatus === 'error' ? (
                <div className="admin-alert admin-alert--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <div>
                    <strong>Commission rules could not be loaded</strong>
                    <p>{rulesError}</p>
                  </div>
                </div>
              ) : null}

              {rulesStatus === 'ready' && !rules.length ? (
                <EmptyState
                  icon={Percent}
                  title="No commission rules"
                  description="Add a rule so sales with a salesperson produce a commission entry."
                  action={
                    canManage ? (
                      <button
                        type="button"
                        className="button button--primary button--md"
                        onClick={() => setRuleForm({ open: true, rule: null })}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Add commission rule
                      </button>
                    ) : null
                  }
                />
              ) : null}

              {rulesStatus === 'ready' && rules.length ? (
                <div className="admin-table__scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Rule</th>
                        <th scope="col">Applies to</th>
                        <th scope="col">Commission</th>
                        <th scope="col">Becomes payable</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="admin-table__actions-head">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => {
                        const busy = busyId === rule.id;
                        return (
                          <tr key={rule.id}>
                            <th scope="row">{rule.name}</th>
                            <td>{ruleTarget(rule)}</td>
                            <td>{ruleRate(rule)}</td>
                            <td>{labelFor(commissionTriggerOptions, rule.payable_trigger)}</td>
                            <td>
                              <span
                                className={`admin-badge admin-badge--${
                                  rule.is_active ? 'success' : 'muted'
                                }`}
                              >
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                {canManage ? (
                                  <>
                                    <button
                                      type="button"
                                      className="table-action"
                                      onClick={() => setRuleForm({ open: true, rule })}
                                      disabled={busy}
                                    >
                                      <Pencil size={15} aria-hidden="true" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="table-action"
                                      onClick={() => toggleRule(rule)}
                                      disabled={busy}
                                    >
                                      <Percent size={15} aria-hidden="true" />
                                      <span>{rule.is_active ? 'Deactivate' : 'Activate'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="table-action table-action--danger"
                                      onClick={() => {
                                        setRuleDeleteError('');
                                        setRuleDelete(rule);
                                      }}
                                      disabled={busy}
                                    >
                                      <Trash2 size={15} aria-hidden="true" />
                                      <span>Delete</span>
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="admin-toolbar">
                <label className="admin-toolbar__search">
                  <Search size={16} className="admin-toolbar__search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search sale, salesperson or rule"
                    aria-label="Search commission ledger"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="admin-toolbar__clear"
                      onClick={() => {
                        setSearch('');
                        setPage(1);
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
                      setPage(1);
                    }}
                    aria-label="Filter by status"
                  >
                    <option value="">All statuses</option>
                    {commissionStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={salespersonFilter}
                    onChange={(event) => {
                      setSalespersonFilter(event.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter by salesperson"
                  >
                    <option value="">Everyone</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  {meta ? (
                    <span className="admin-toolbar__count">
                      {meta.total} entr{meta.total === 1 ? 'y' : 'ies'}
                    </span>
                  ) : null}
                </div>
              </div>

              {ledgerStatus === 'loading' ? (
                <div className="admin-loading" role="status">
                  <LoaderCircle size={20} className="spin" aria-hidden="true" />
                  Loading commission ledger…
                </div>
              ) : null}

              {ledgerStatus === 'error' ? (
                <div className="admin-alert admin-alert--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <div>
                    <strong>Commission ledger could not be loaded</strong>
                    <p>{ledgerError}</p>
                  </div>
                </div>
              ) : null}

              {ledgerStatus === 'ready' && !commissions.length ? (
                <EmptyState
                  icon={Banknote}
                  title="No commission entries found"
                  description={
                    hasLedgerFilters
                      ? 'Try a different search or filter.'
                      : 'Sales with a salesperson and a matching active rule will appear here.'
                  }
                />
              ) : null}

              {ledgerStatus === 'ready' && commissions.length ? (
                <>
                  <div className="admin-table__scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Salesperson</th>
                          <th scope="col">Sale</th>
                          <th scope="col">Base amount</th>
                          <th scope="col">Commission</th>
                          <th scope="col">Status</th>
                          <th scope="col" className="admin-table__actions-head">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.map((entry) => {
                          const busy = busyId === entry.id;
                          return (
                            <tr key={entry.id}>
                              <th scope="row">
                                <span className="admin-table__stack">
                                  <span className="admin-table__title">
                                    {entry.salesperson?.name || 'Unassigned'}
                                  </span>
                                  <span className="admin-table__muted">
                                    {entry.rule?.name || 'Rule removed'}
                                  </span>
                                </span>
                              </th>
                              <td>
                                {entry.sale ? (
                                  <Link
                                    className="admin-table__title"
                                    to={`/admin/sales/${entry.sale.id}`}
                                  >
                                    {entry.sale.number}
                                  </Link>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>{formatPrice(entry.base_amount || 0, currency)}</td>
                              <td>{formatPrice(entry.commission_amount || 0, currency)}</td>
                              <td>
                                <span
                                  className={`admin-badge admin-badge--${commissionTone(
                                    entry.status,
                                  )}`}
                                >
                                  {labelFor(commissionStatusOptions, entry.status)}
                                </span>
                              </td>
                              <td>
                                <div className="table-actions">
                                  {canManage && entry.status === 'pending' ? (
                                    <button
                                      type="button"
                                      className="table-action"
                                      onClick={() => changeCommission(entry, 'approved')}
                                      disabled={busy}
                                    >
                                      <Check size={15} aria-hidden="true" />
                                      <span>Approve</span>
                                    </button>
                                  ) : null}
                                  {canManage && entry.status === 'approved' ? (
                                    <button
                                      type="button"
                                      className="table-action"
                                      onClick={() => changeCommission(entry, 'paid')}
                                      disabled={busy}
                                    >
                                      <Banknote size={15} aria-hidden="true" />
                                      <span>Mark paid</span>
                                    </button>
                                  ) : null}
                                  {canManage && entry.status !== 'cancelled' ? (
                                    <button
                                      type="button"
                                      className="table-action table-action--danger"
                                      onClick={() => {
                                        setCommissionCancelError('');
                                        setCommissionCancel(entry);
                                      }}
                                      disabled={busy}
                                    >
                                      <Ban size={15} aria-hidden="true" />
                                      <span>Cancel</span>
                                    </button>
                                  ) : null}
                                  {!canManage || entry.status === 'cancelled' ? (
                                    <span className="admin-table__muted">—</span>
                                  ) : null}
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
                      label="Commission pagination"
                    />
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </Container>

      {ruleForm.open ? (
        <CommissionRuleModal
          key={ruleForm.rule?.id || 'new'}
          rule={ruleForm.rule}
          projects={projects}
          unitTypes={unitTypes}
          currency={currency}
          onClose={() => setRuleForm({ open: false, rule: null })}
          onSaved={refresh}
        />
      ) : null}

      <Modal
        open={Boolean(ruleDelete)}
        onClose={() => (deletingRule ? null : setRuleDelete(null))}
        title="Delete commission rule"
        description={
          ruleDelete
            ? `Delete ${ruleDelete.name}? Existing commission entries keep their rule history.`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setRuleDelete(null)}
              disabled={deletingRule}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmDeleteRule}
              disabled={deletingRule}
            >
              {deletingRule ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {deletingRule ? 'Deleting…' : 'Delete rule'}
            </button>
          </>
        }
      >
        {ruleDeleteError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{ruleDeleteError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">
            Deactivate the rule instead if you want to keep it for new sales later.
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(commissionCancel)}
        onClose={() => (cancellingCommission ? null : setCommissionCancel(null))}
        title="Cancel commission"
        description={
          commissionCancel
            ? `Cancel the commission for ${commissionCancel.sale?.number || 'this sale'}?`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setCommissionCancel(null)}
              disabled={cancellingCommission}
            >
              Keep commission
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmCancelCommission}
              disabled={cancellingCommission}
            >
              {cancellingCommission ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : null}
              {cancellingCommission ? 'Cancelling…' : 'Cancel commission'}
            </button>
          </>
        }
      >
        {commissionCancelError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{commissionCancelError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">
            The entry remains in the ledger with a cancelled status for reporting.
          </p>
        )}
      </Modal>
    </>
  );
}
