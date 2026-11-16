import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import adminApiService from '../../services/adminApiService';

export default function AdminRoles() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('roles.create');
  const canEdit = hasPermission('roles.edit');
  const canDelete = hasPermission('roles.delete');

  const [roles, setRoles] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const data = await adminApiService.listRoles();
        if (ignore) return;
        setRoles(data);
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'Roles could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApiService.deleteRole(deleteTarget.id);
      addToast(`"${deleteTarget.name}" was deleted.`, 'success');
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDeleteError(error.message || 'The role could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageMeta
        title="Roles & permissions"
        description="Define reusable role-based access for the workspace team."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Workspace access</p>
            <h1 className="admin-page__title">Roles & permissions</h1>
            <p className="admin-page__description">
              Roles bundle module permissions. A team member can hold several roles; the server
              applies the combined permissions on every request.
            </p>
          </div>
          {canCreate ? (
            <Link className="button button--primary button--md" to="/admin/roles/new">
              <Plus size={16} aria-hidden="true" />
              New role
            </Link>
          ) : null}
        </div>

        {status === 'loading' ? (
          <div className="admin-loading" role="status">
            <LoaderCircle size={20} className="spin" aria-hidden="true" />
            Loading roles…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Roles could not be loaded</strong>
              <p>{loadError}</p>
            </div>
          </div>
        ) : null}

        {status === 'ready' ? (
          <div className="admin-panel">
            {!roles.length ? (
              <EmptyState
                icon={ShieldCheck}
                title="No roles yet"
                description="Create a role to start granting module permissions."
                action={
                  canCreate ? (
                    <Link className="button button--primary button--md" to="/admin/roles/new">
                      <Plus size={16} aria-hidden="true" />
                      New role
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="admin-table__scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Role</th>
                      <th scope="col">Description</th>
                      <th scope="col">Members</th>
                      <th scope="col">Permissions</th>
                      <th scope="col">Type</th>
                      <th scope="col" className="admin-table__actions-head">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => {
                      const deleteBlocked = role.is_default || role.member_count > 0;
                      return (
                        <tr key={role.id}>
                          <th scope="row">
                            <span className="admin-table__title">{role.name}</span>
                          </th>
                          <td>
                            {role.description || (
                              <span className="admin-table__muted">No description</span>
                            )}
                          </td>
                          <td>
                            <span className="admin-table__count">
                              <Users size={14} aria-hidden="true" />
                              {role.member_count || 0}
                            </span>
                          </td>
                          <td>
                            <span className="admin-table__count">
                              <ShieldCheck size={14} aria-hidden="true" />
                              {role.permission_count || 0}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`admin-badge${
                                role.is_default ? ' admin-badge--gold' : ' admin-badge--muted'
                              }`}
                            >
                              {role.is_default ? 'Default' : 'Custom'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {canEdit ? (
                                <Link className="table-action" to={`/admin/roles/${role.id}/edit`}>
                                  <Pencil size={15} aria-hidden="true" />
                                  <span>Edit</span>
                                </Link>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="table-action table-action--danger"
                                  onClick={() => {
                                    setDeleteError('');
                                    setDeleteTarget(role);
                                  }}
                                  disabled={deleteBlocked}
                                  title={
                                    role.is_default
                                      ? 'Default roles cannot be deleted.'
                                      : role.member_count > 0
                                        ? 'Remove this role from its members first.'
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Container>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete role"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Members keep their account but lose the permissions this role granted.`
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
              {deleting ? 'Deleting…' : 'Delete role'}
            </button>
          </>
        }
      >
        {deleteError ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{deleteError}</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
