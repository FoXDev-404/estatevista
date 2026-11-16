import { useEffect, useState } from 'react';
import {
  AlertCircle,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
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

const EMPTY_FORM = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  manager_id: '',
  is_active: true,
};

export default function AdminBranches() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('branches.create');
  const canEdit = hasPermission('branches.edit');
  const canDelete = hasPermission('branches.delete');

  const [branches, setBranches] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const [lookups, setLookups] = useState({ users: [] });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const result = await adminApiService.listBranches({
          search: debouncedSearch,
          status: statusFilter,
        });
        if (ignore) return;
        setBranches(result.data);
        setMeta(result.meta);
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'Branches could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [debouncedSearch, statusFilter, reloadKey]);

  useEffect(() => {
    let ignore = false;
    adminApiService
      .getLookups()
      .then((data) => {
        if (!ignore) setLookups(data);
      })
      .catch(() => {
        // The manager selector is optional; the list still works without it.
      });
    return () => {
      ignore = true;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(branch) {
    setEditing(branch);
    setForm({
      name: branch.name || '',
      code: branch.code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      address: branch.address || '',
      manager_id: branch.manager_id || '',
      is_active: branch.is_active,
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
      const value = field === 'is_active' ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
      setFormErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      if (editing) {
        await adminApiService.updateBranch(editing.id, payload);
        addToast(`"${payload.name}" was updated.`, 'success');
      } else {
        await adminApiService.createBranch(payload);
        addToast(`"${payload.name}" was created.`, 'success');
      }
      setFormOpen(false);
      setEditing(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError) setFormErrors(error.fields || {});
      addToast(error.message || 'The branch could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(branch) {
    setBusyId(branch.id);
    try {
      const updated = await adminApiService.updateBranchStatus(branch.id, !branch.is_active);
      setBranches((current) =>
        current.map((row) => (row.id === branch.id ? { ...row, ...updated } : row)),
      );
      addToast(
        `"${branch.name}" was ${updated.is_active ? 'activated' : 'deactivated'}.`,
        'success',
      );
    } catch (error) {
      addToast(error.message || 'The branch status could not be changed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApiService.deleteBranch(deleteTarget.id);
      addToast(`"${deleteTarget.name}" was deleted.`, 'success');
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDeleteError(error.message || 'The branch could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageMeta
        title="Branches"
        description="Manage the company's branch offices and their managers."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="admin-page__title">Branches</h1>
            <p className="admin-page__description">
              Branch offices group the team, projects and future transactions. Deactivate a
              branch that still has history instead of deleting it.
            </p>
          </div>
          {canCreate ? (
            <button type="button" className="button button--primary button--md" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" />
              New branch
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
                placeholder="Search by name, code, email or phone"
                aria-label="Search branches"
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
                  {meta.total} branch{meta.total === 1 ? '' : 'es'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading branches…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Branches could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !branches.length ? (
            <EmptyState
              icon={MapPin}
              title="No branches found"
              description={
                search || statusFilter
                  ? 'Try a different search or status filter.'
                  : 'Create the first branch office to group your team and projects.'
              }
              action={
                canCreate && !search && !statusFilter ? (
                  <button type="button" className="button button--primary button--md" onClick={openCreate}>
                    <Plus size={16} aria-hidden="true" />
                    New branch
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && branches.length ? (
            <div className="admin-table__scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Branch</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Manager</th>
                    <th scope="col">Team</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="admin-table__actions-head">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id}>
                      <th scope="row">
                        <span className="admin-table__title">{branch.name}</span>
                        <code className="admin-table__code">{branch.code}</code>
                      </th>
                      <td>
                        <span className="admin-table__stack">
                          <span>{branch.phone || 'No phone'}</span>
                          <span className="admin-table__muted">{branch.email || 'No email'}</span>
                        </span>
                      </td>
                      <td>{branch.manager?.name || <span className="admin-table__muted">Unassigned</span>}</td>
                      <td>
                        <span className="admin-table__count">{branch.team_count || 0}</span>
                      </td>
                      <td>
                        <span className={`admin-badge${branch.is_active ? ' admin-badge--active' : ' admin-badge--muted'}`}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {canEdit ? (
                            <>
                              <button type="button" className="table-action" onClick={() => openEdit(branch)}>
                                <Pencil size={15} aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="table-action"
                                onClick={() => toggleStatus(branch)}
                                disabled={busyId === branch.id}
                              >
                                {busyId === branch.id ? (
                                  <LoaderCircle size={15} className="spin" aria-hidden="true" />
                                ) : (
                                  <Power size={15} aria-hidden="true" />
                                )}
                                <span>{branch.is_active ? 'Deactivate' : 'Activate'}</span>
                              </button>
                            </>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className="table-action table-action--danger"
                              onClick={() => {
                                setDeleteError('');
                                setDeleteTarget(branch);
                              }}
                              disabled={(branch.team_count || 0) > 0}
                              title={
                                (branch.team_count || 0) > 0
                                  ? 'Deactivate this branch instead of deleting it.'
                                  : undefined
                              }
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span>Delete</span>
                            </button>
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
        title={editing ? 'Edit branch' : 'New branch'}
        description={
          editing
            ? 'Update the branch details. Changes are recorded in the audit log.'
            : 'Add a branch office for the team, projects and transactions.'
        }
        footer={
          <>
            <button type="button" className="button button--secondary button--md" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              form="branch-form"
              className="button button--primary button--md"
              disabled={saving}
            >
              {saving ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {saving ? 'Saving…' : editing ? 'Save branch' : 'Create branch'}
            </button>
          </>
        }
      >
        <form id="branch-form" className="admin-modal-form" onSubmit={handleSubmit} noValidate>
          <div className="admin-form-grid">
            <FormField
              label="Branch name"
              id="branch-name"
              value={form.name}
              onChange={updateField('name')}
              error={formErrors.name}
              required
            />
            <FormField
              label="Branch code"
              id="branch-code"
              value={form.code}
              onChange={updateField('code')}
              error={formErrors.code}
              hint="Letters, numbers, hyphens or underscores."
              required
            />
            <FormField
              label="Phone"
              id="branch-phone"
              value={form.phone}
              onChange={updateField('phone')}
              error={formErrors.phone}
            />
            <FormField
              label="Email"
              id="branch-email"
              type="email"
              value={form.email}
              onChange={updateField('email')}
              error={formErrors.email}
            />
            <FormField
              label="Manager"
              id="branch-manager"
              as="select"
              value={form.manager_id}
              onChange={updateField('manager_id')}
              error={formErrors.manager_id}
            >
              <option value="">Unassigned</option>
              {(lookups.users || [])
                .filter((member) => member.is_active)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.email}
                  </option>
                ))}
            </FormField>
            <FormField
              label="Address"
              id="branch-address"
              as="textarea"
              rows={3}
              className="admin-form-grid__full"
              value={form.address}
              onChange={updateField('address')}
              error={formErrors.address}
            />
            <label className="form-checkbox admin-form-grid__full">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={updateField('is_active')}
              />
              <span>
                <strong>Active branch</strong>
                <small>Inactive branches stay in history but are hidden from new records.</small>
              </span>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete branch"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This cannot be undone. Branches with team members or projects cannot be deleted.`
            : ''
        }
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
              {deleting ? 'Deleting…' : 'Delete branch'}
            </button>
          </>
        }
      >
        {deleteError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{deleteError}</p>
          </div>
        ) : (
          <p className="admin-modal-note">
            If this branch has history, deactivate it instead — the record and its links to people
            and projects stay intact.
          </p>
        )}
      </Modal>
    </>
  );
}
