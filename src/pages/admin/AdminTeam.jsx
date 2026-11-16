import { useEffect, useState } from 'react';
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { ApiError } from '../../services/apiClient';
import adminApiService from '../../services/adminApiService';
import { formatRelativeTime, initialsOf } from '../../services/adminFormatters';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  branch_id: '',
  full_access: false,
  role_ids: [],
  is_active: true,
  password: '',
  password_confirmation: '',
};

export default function AdminTeam() {
  const { user: currentUser, hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('team.create');
  const canEdit = hasPermission('team.edit');

  const [members, setMembers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const [lookups, setLookups] = useState({ branches: [], roles: [], users: [] });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const result = await adminApiService.listTeam({
          search: debouncedSearch,
          branch_id: branchFilter,
          status: statusFilter,
        });
        if (ignore) return;
        setMembers(result.data);
        setMeta(result.meta);
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'The team could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [debouncedSearch, branchFilter, statusFilter, reloadKey]);

  useEffect(() => {
    let ignore = false;
    adminApiService
      .getLookups()
      .then((data) => {
        if (!ignore) setLookups(data);
      })
      .catch(() => {
        // Form selectors stay empty; existing rows still render.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const isSelf = editing?.id === currentUser?.id;
  const canGrantFullAccess = Boolean(currentUser?.full_access);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role_ids: [] });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(member) {
    setEditing(member);
    setForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      branch_id: member.branch_id || '',
      full_access: Boolean(member.full_access),
      role_ids: (member.roles || []).map((role) => role.id),
      is_active: member.is_active,
      password: '',
      password_confirmation: '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormErrors({});
  }

  function updateField(field) {
    return (event) => {
      const raw = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [field]: raw }));
      setFormErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function toggleRole(roleId) {
    setForm((current) => {
      const selected = current.role_ids.includes(roleId);
      return {
        ...current,
        role_ids: selected
          ? current.role_ids.filter((id) => id !== roleId)
          : [...current.role_ids, roleId],
      };
    });
    setFormErrors((current) => ({ ...current, role_ids: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      const base = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        branch_id: form.branch_id || null,
        full_access: form.full_access,
        role_ids: form.role_ids,
      };

      if (editing) {
        const payload = { ...base, is_active: form.is_active };
        if (form.password) {
          payload.password = form.password;
          payload.password_confirmation = form.password_confirmation;
        }
        await adminApiService.updateTeamMember(editing.id, payload);
        addToast(`"${form.name}" was updated.`, 'success');
      } else {
        await adminApiService.createTeamMember({
          ...base,
          password: form.password,
          password_confirmation: form.password_confirmation,
        });
        addToast(`"${form.name}" was invited to the workspace.`, 'success');
      }
      setFormOpen(false);
      setEditing(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError) setFormErrors(error.fields || {});
      addToast(error.message || 'The team member could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(member) {
    setBusyId(member.id);
    try {
      const updated = await adminApiService.updateTeamStatus(member.id, !member.is_active);
      setMembers((current) =>
        current.map((row) => (row.id === member.id ? { ...row, ...updated } : row)),
      );
      addToast(
        `"${member.name}" was ${updated.is_active ? 'reactivated' : 'deactivated'}.`,
        'success',
      );
    } catch (error) {
      addToast(error.message || 'The team member status could not be changed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageMeta
        title="Team"
        description="Invite team members, assign roles and branches, and control workspace access."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operation team</p>
            <h1 className="admin-page__title">Team</h1>
            <p className="admin-page__description">
              Full-access users bypass the role matrix. Everyone else receives the combined
              permissions of the roles assigned here.
            </p>
          </div>
          {canCreate ? (
            <button type="button" className="button button--primary button--md" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" />
              Invite member
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email or phone"
                aria-label="Search team"
              />
              {search ? (
                <button
                  type="button"
                  className="admin-toolbar__clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="admin-toolbar__filters">
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                aria-label="Filter by branch"
              >
                <option value="">All branches</option>
                {(lookups.branches || []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} member{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading team…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>The team could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !members.length ? (
            <EmptyState
              icon={UserRound}
              title="No team members found"
              description={
                search || branchFilter || statusFilter
                  ? 'Try a different search or filter.'
                  : 'Invite the first teammate and assign a role.'
              }
              action={
                canCreate && !search && !branchFilter && !statusFilter ? (
                  <button type="button" className="button button--primary button--md" onClick={openCreate}>
                    <Plus size={16} aria-hidden="true" />
                    Invite member
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && members.length ? (
            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Access</th>
                    <th scope="col">Roles</th>
                    <th scope="col">Branch</th>
                    <th scope="col">Last login</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="admin-table__actions-head">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <th scope="row">
                        <div className="admin-member">
                          <span className="admin-member__avatar" aria-hidden="true">
                            {initialsOf(member.name) || '?'}
                          </span>
                          <span className="admin-member__meta">
                            <span className="admin-table__title">
                              {member.name}
                              {member.id === currentUser?.id ? (
                                <span className="admin-member__you">You</span>
                              ) : null}
                            </span>
                            <span className="admin-table__muted">{member.email}</span>
                          </span>
                        </div>
                      </th>
                      <td>
                        <span
                          className={`admin-badge${
                            member.full_access ? ' admin-badge--gold' : ' admin-badge--muted'
                          }`}
                        >
                          {member.full_access ? 'Full access' : 'Role based'}
                        </span>
                      </td>
                      <td>
                        {member.roles?.length ? (
                          <span className="admin-tag-list">
                            {member.roles.map((role) => (
                              <span className="admin-tag" key={role.id}>
                                {role.name}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="admin-table__muted">No roles</span>
                        )}
                      </td>
                      <td>{member.branch?.name || <span className="admin-table__muted">—</span>}</td>
                      <td>{formatRelativeTime(member.last_login_at)}</td>
                      <td>
                        <span
                          className={`admin-badge${
                            member.is_active ? ' admin-badge--active' : ' admin-badge--muted'
                          }`}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {canEdit ? (
                            <>
                              <button type="button" className="table-action" onClick={() => openEdit(member)}>
                                <Pencil size={15} aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => toggleStatus(member)}
                                disabled={busyId === member.id || member.id === currentUser?.id}
                                title={
                                  member.id === currentUser?.id
                                    ? 'You cannot deactivate your own account.'
                                    : undefined
                                }
                              >
                                {busyId === member.id ? (
                                  <LoaderCircle size={15} className="spin" aria-hidden="true" />
                                ) : (
                                  <Power size={15} aria-hidden="true" />
                                )}
                                <span>{member.is_active ? 'Deactivate' : 'Activate'}</span>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Container>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit team member' : 'Invite team member'}
        description={
          editing
            ? 'Update access, roles and branch. Changes apply immediately after saving.'
            : 'Create a workspace login and assign the roles this person needs.'
        }
        size="large"
        footer={
          <>
            <button type="button" className="button button--secondary button--md" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              form="team-form"
              className="button button--primary button--md"
              disabled={saving}
            >
              {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {saving ? 'Saving…' : editing ? 'Save member' : 'Invite member'}
            </button>
          </>
        }
      >
        <form id="team-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-grid">
            <FormField
              label="Full name"
              id="team-name"
              value={form.name}
              onChange={updateField('name')}
              error={formErrors.name}
              required
            />
            <FormField
              label="Email address"
              id="team-email"
              type="email"
              value={form.email}
              onChange={updateField('email')}
              error={formErrors.email}
              required
            />
            <FormField
              label="Phone"
              id="team-phone"
              value={form.phone}
              onChange={updateField('phone')}
              error={formErrors.phone}
            />
            <FormField
              label="Branch"
              id="team-branch"
              as="select"
              value={form.branch_id}
              onChange={updateField('branch_id')}
              error={formErrors.branch_id}
            >
              <option value="">Unassigned</option>
              {(lookups.branches || [])
                .filter((branch) => branch.is_active || branch.id === form.branch_id)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
            </FormField>
            <FormField
              label={editing ? 'New password (optional)' : 'Temporary password'}
              id="team-password"
              type="password"
              value={form.password}
              onChange={updateField('password')}
              error={formErrors.password}
              hint="At least 8 characters with a letter and a number."
              required={!editing}
            />
            <FormField
              label="Confirm password"
              id="team-password-confirmation"
              type="password"
              value={form.password_confirmation}
              onChange={updateField('password_confirmation')}
              error={formErrors.password_confirmation}
              required={Boolean(form.password)}
            />
          </div>

          <fieldset className="admin-fieldset">
            <legend>Workspace access</legend>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.full_access}
                onChange={updateField('full_access')}
                disabled={!canGrantFullAccess || isSelf}
              />
              <span>
                <strong>
                  <ShieldCheck size={14} aria-hidden="true" /> Full access
                </strong>
                <small>
                  {isSelf
                    ? 'You cannot change your own access mode.'
                    : canGrantFullAccess
                      ? 'Bypasses the role matrix. Reserve this for workspace administrators.'
                      : 'Only a full-access administrator can grant this.'}
                </small>
              </span>
            </label>

            <div className="admin-role-options" aria-label="Assigned roles">
              {(lookups.roles || []).map((role) => (
                <label className="admin-role-option" key={role.id}>
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    disabled={isSelf || form.full_access}
                  />
                  <span>
                    {role.name}
                    {role.is_default ? <small>Default</small> : null}
                  </span>
                </label>
              ))}
            </div>
            {formErrors.role_ids ? (
              <p className="form-field__error" role="alert">
                {formErrors.role_ids}
              </p>
            ) : null}
            {form.full_access ? (
              <p className="admin-fieldset__note">
                Roles are not required while full access is enabled, but they remain assigned for
                reference.
              </p>
            ) : null}
          </fieldset>

          {editing ? (
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={updateField('is_active')}
                disabled={isSelf}
              />
              <span>
                <strong>Active account</strong>
                <small>
                  {isSelf
                    ? 'You cannot deactivate your own account.'
                    : 'Deactivating revokes existing sessions and blocks sign-in.'}
                </small>
              </span>
            </label>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
