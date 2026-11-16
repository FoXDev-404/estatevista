import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FilterX, History, LoaderCircle } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Pagination from '../../components/properties/Pagination';
import adminApiService from '../../services/adminApiService';
import {
  formatDateTime,
  formatRelativeTime,
  moduleLabel,
} from '../../services/adminFormatters';

const EMPTY_FILTERS = {
  user_id: '',
  module: '',
  event: '',
  date_from: '',
  date_to: '',
};

const EVENT_LABELS = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  login: 'Signed in',
  logout: 'Signed out',
  password_changed: 'Password changed',
  status_changed: 'Status changed',
  followup_added: 'Follow-up added',
  followup_completed: 'Follow-up completed',
  converted: 'Converted',
};

const EVENT_BADGES = {
  created: 'admin-badge--success',
  updated: 'admin-badge--muted',
  deleted: 'admin-badge--danger',
  login: 'admin-badge--active',
  logout: 'admin-badge--muted',
  password_changed: 'admin-badge--gold',
  status_changed: 'admin-badge--gold',
  followup_added: 'admin-badge--active',
  followup_completed: 'admin-badge--success',
  converted: 'admin-badge--success',
};

const FALLBACK_EVENTS = Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label }));

const FALLBACK_MODULES = [
  'Company',
  'Branch',
  'User',
  'Role',
  'NumberSequence',
  'auth',
].map((value) => ({ value, label: moduleLabel(value) }));

const FIELD_LABELS = {
  name: 'Name',
  legal_name: 'Legal name',
  registration_number: 'Registration number',
  tax_number: 'Tax / VAT number',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  city: 'City',
  state: 'State / region',
  postal_code: 'Postal code',
  country: 'Country',
  currency: 'Currency',
  timezone: 'Timezone',
  date_format: 'Date format',
  number_decimals: 'Number decimals',
  document_type: 'Document type',
  prefix: 'Prefix',
  padding: 'Padding',
  reset_period: 'Reset period',
  next_value: 'Next value',
  code: 'Code',
  manager_id: 'Manager ID',
  is_active: 'Active',
  full_access: 'Full access',
  roles: 'Roles',
  branch: 'Branch',
  branch_id: 'Branch ID',
  description: 'Description',
  permission_keys: 'Permissions',
  password_hash: 'Password',
  session_id: 'Session ID',
};

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function buildDiffRows(entry) {
  if (!entry) return [];
  const before = entry.before_data && typeof entry.before_data === 'object' ? entry.before_data : {};
  const after = entry.after_data && typeof entry.after_data === 'object' ? entry.after_data : {};

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => key !== 'password_hash',
  );
  const changed = keys.filter((key) => !sameValue(before[key], after[key]));
  const visible = changed.length ? changed : keys;

  return visible.map((key) => ({
    key,
    label: fieldLabel(key),
    before: displayValue(before[key]),
    after: displayValue(after[key]),
    changed: !sameValue(before[key], after[key]),
  }));
}

export default function AdminAuditLogs() {
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({
    modules: FALLBACK_MODULES,
    events: FALLBACK_EVENTS,
    users: [],
  });
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let ignore = false;

    adminApiService
      .getAuditOptions()
      .then((data) => {
        if (ignore) return;
        setOptions({
          modules: data.modules?.length ? data.modules : FALLBACK_MODULES,
          events: data.events?.length ? data.events : FALLBACK_EVENTS,
          users: data.users || [],
        });
      })
      .catch(() => {
        // Filter selects fall back to the built-in catalog.
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const result = await adminApiService.listAuditLogs({
          ...filters,
          page,
          limit: 25,
        });
        if (ignore) return;
        setEntries(result.data);
        setMeta(result.meta);
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'The audit log could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [filters, page, reloadKey]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const diffRows = useMemo(() => buildDiffRows(detail), [detail]);
  const users = options.users || [];
  const modules = options.modules || FALLBACK_MODULES;
  const events = options.events || FALLBACK_EVENTS;

  function updateFilter(field) {
    return (event) => {
      const value = event.target.value;
      setFilters((current) => ({ ...current, [field]: value }));
      setPage(1);
    };
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function refresh() {
    setReloadKey((value) => value + 1);
  }

  return (
    <>
      <PageMeta
        title="Audit log"
        description="Review every recorded workspace change with before and after values."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Workspace history</p>
            <h1 className="admin-page__title">Audit log</h1>
            <p className="admin-page__description">
              Every settings, branch, team and role change is recorded with the signed-in user and
              a before/after snapshot. Sign-in events are listed as well.
            </p>
          </div>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={refresh}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <History size={16} aria-hidden="true" />
            )}
            Refresh
          </button>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__header admin-panel__header--wrap">
            <div>
              <h2 className="admin-panel__title">Recorded activity</h2>
              <p className="admin-panel__description">
                Newest first. Filter by person, module, event or date to narrow the history.
              </p>
            </div>
            <span className="admin-toolbar__count">
              {meta ? `${meta.total} ${meta.total === 1 ? 'entry' : 'entries'}` : '—'}
            </span>
          </div>

          <div className="admin-filters">
            <div className="admin-filters__field">
              <FormField
                label="Team member"
                id="audit-user"
                as="select"
                value={filters.user_id}
                onChange={updateFilter('user_id')}
              >
                <option value="">Anyone</option>
                {users.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.is_active === false ? ' (inactive)' : ''}
                  </option>
                ))}
              </FormField>
            </div>

            <div className="admin-filters__field">
              <FormField
                label="Module"
                id="audit-module"
                as="select"
                value={filters.module}
                onChange={updateFilter('module')}
              >
                <option value="">All modules</option>
                {modules.map((module) => (
                  <option key={module.value} value={module.value}>
                    {module.label}
                  </option>
                ))}
              </FormField>
            </div>

            <div className="admin-filters__field">
              <FormField
                label="Event"
                id="audit-event"
                as="select"
                value={filters.event}
                onChange={updateFilter('event')}
              >
                <option value="">All events</option>
                {events.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FormField>
            </div>

            <div className="admin-filters__field">
              <FormField
                label="From"
                id="audit-date-from"
                type="date"
                value={filters.date_from}
                onChange={updateFilter('date_from')}
              />
            </div>

            <div className="admin-filters__field">
              <FormField
                label="To"
                id="audit-date-to"
                type="date"
                value={filters.date_to}
                onChange={updateFilter('date_to')}
              />
            </div>

            <button
              type="button"
              className="button button--secondary button--sm admin-filters__clear"
              onClick={clearFilters}
              disabled={!activeFilterCount}
            >
              <FilterX size={15} aria-hidden="true" />
              Clear
              {activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading activity…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>The audit log could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !entries.length ? (
            <EmptyState
              icon={History}
              title="No activity found"
              description={
                activeFilterCount
                  ? 'Try a different filter combination or clear the filters.'
                  : 'Changes made in the workspace will appear here.'
              }
              action={
                activeFilterCount ? (
                  <button
                    type="button"
                    className="button button--secondary button--md"
                    onClick={clearFilters}
                  >
                    <FilterX size={15} aria-hidden="true" />
                    Clear filters
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && entries.length ? (
            <>
              <div className="admin-table__scroll">
                <table className="admin-table admin-audit-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Person</th>
                      <th scope="col">Module</th>
                      <th scope="col">Event</th>
                      <th scope="col">Record</th>
                      <th scope="col" className="admin-table__actions-head">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const hasSnapshot = Boolean(entry.before_data || entry.after_data);
                      const username = entry.user?.name || 'System';
                      return (
                        <tr key={entry.id}>
                          <td>
                            <span className="admin-table__stack">
                              <span>{formatDateTime(entry.created_at)}</span>
                              <span className="admin-table__muted">
                                {formatRelativeTime(entry.created_at)}
                              </span>
                            </span>
                          </td>
                          <td>
                            <span className="admin-table__stack">
                              <span>{username}</span>
                              {entry.user?.email ? (
                                <span className="admin-table__muted">{entry.user.email}</span>
                              ) : null}
                            </span>
                          </td>
                          <td>{moduleLabel(entry.module)}</td>
                          <td>
                            <span
                              className={`admin-badge ${
                                EVENT_BADGES[entry.event] || 'admin-badge--muted'
                              }`}
                            >
                              {EVENT_LABELS[entry.event] || fieldLabel(entry.event || '')}
                            </span>
                          </td>
                          <td>
                            {entry.record_id ? (
                              <code
                                className="admin-audit-table__record"
                                title={entry.record_id}
                              >
                                {String(entry.record_id).slice(0, 8)}…
                              </code>
                            ) : (
                              <span className="admin-table__muted">—</span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => setDetail(entry)}
                                disabled={!hasSnapshot}
                                title={
                                  hasSnapshot
                                    ? 'View the recorded before and after values.'
                                    : 'No field snapshot was recorded for this event.'
                                }
                              >
                                <History size={15} aria-hidden="true" />
                                <span>{hasSnapshot ? 'View changes' : 'No snapshot'}</span>
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
                  label="Audit log pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `${EVENT_LABELS[detail.event] || fieldLabel(detail.event || '')} · ${moduleLabel(detail.module)}`
            : 'Audit entry'
        }
        description={
          detail
            ? `${detail.user?.name || 'System'} · ${formatDateTime(detail.created_at)}`
            : ''
        }
        size="large"
        footer={
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={() => setDetail(null)}
          >
            Close
          </button>
        }
      >
        {detail ? (
          <div className="admin-audit-detail">
            <dl className="admin-audit-detail__meta">
              <div>
                <dt>Module</dt>
                <dd>{moduleLabel(detail.module)}</dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>{EVENT_LABELS[detail.event] || fieldLabel(detail.event || '')}</dd>
              </div>
              <div>
                <dt>Record</dt>
                <dd>
                  {detail.record_id ? (
                    <code className="admin-audit-detail__record">{detail.record_id}</code>
                  ) : (
                    'Not recorded'
                  )}
                </dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>{formatDateTime(detail.created_at)}</dd>
              </div>
            </dl>

            {diffRows.length ? (
              <div className="admin-table__scroll">
                <table className="admin-table admin-audit-diff">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Before</th>
                      <th scope="col">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">{row.label}</th>
                        <td
                          className={
                            row.changed && row.before !== '—'
                              ? 'admin-audit-diff__value admin-audit-diff__value--before'
                              : 'admin-audit-diff__value'
                          }
                        >
                          {row.before}
                        </td>
                        <td
                          className={
                            row.changed && row.after !== '—'
                              ? 'admin-audit-diff__value admin-audit-diff__value--after'
                              : 'admin-audit-diff__value'
                          }
                        >
                          {row.after}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-audit-detail__empty">
                No field-level values were recorded for this event.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
