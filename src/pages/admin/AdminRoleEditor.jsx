import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  LoaderCircle,
  Save,
  ShieldCheck,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import FormField from '../../components/common/FormField';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { ApiError } from '../../services/apiClient';
import adminApiService from '../../services/adminApiService';

const ACTION_ORDER = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'cancel',
  'void',
  'terminate',
  'collect',
  'export',
];

function ModuleToggle({ permissions, selected, onToggle }) {
  const ref = useRef(null);
  const selectedCount = permissions.filter((permission) => selected.has(permission)).length;
  const all = selectedCount === permissions.length;
  const some = selectedCount > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={all}
      onChange={() => onToggle(permissions, !all)}
      aria-label="Toggle all actions for this module"
    />
  );
}

export default function AdminRoleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const editing = Boolean(id);
  const canSave = editing ? hasPermission('roles.edit') : hasPermission('roles.create');

  const [catalog, setCatalog] = useState({ groups: [], total: 0 });
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const [catalogData, role] = await Promise.all([
          adminApiService.getPermissionCatalog(),
          editing ? adminApiService.getRole(id) : Promise.resolve(null),
        ]);
        if (ignore) return;

        setCatalog(catalogData);
        if (role) {
          setName(role.name || '');
          setDescription(role.description || '');
          setSelected(new Set(role.permission_keys || []));
        } else if (editing) {
          setLoadError('Role not found.');
          setStatus('error');
          return;
        }
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'The role editor could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [editing, id]);

  const allPermissions = useMemo(
    () =>
      catalog.groups.flatMap((group) =>
        group.modules.flatMap((module) => module.actions.map((action) => action.permission)),
      ),
    [catalog],
  );

  function togglePermission(permission) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
    setErrors((current) => ({ ...current, permission_keys: undefined }));
  }

  function togglePermissions(permissions, checked) {
    setSelected((current) => {
      const next = new Set(current);
      permissions.forEach((permission) => {
        if (checked) next.add(permission);
        else next.delete(permission);
      });
      return next;
    });
  }

  function selectAll(checked) {
    setSelected(checked ? new Set(allPermissions) : new Set());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        name,
        description,
        permission_keys: [...selected].sort(),
      };
      if (editing) {
        await adminApiService.updateRole(id, payload);
        addToast(`"${name}" was updated.`, 'success');
      } else {
        await adminApiService.createRole(payload);
        addToast(`"${name}" was created.`, 'success');
      }
      navigate('/admin/roles');
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The role could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageMeta
        title={editing ? 'Edit role' : 'New role'}
        description="Choose the module permissions granted by this role."
        noIndex
      />
      <Container className="admin-page admin-form-page">
        <Link className="back-link" to="/admin/roles">
          <ChevronLeft size={16} aria-hidden="true" />
          Back to roles
        </Link>

        <div className="admin-page__header">
          <div>
            <p className="eyebrow">{editing ? 'Edit role' : 'New role'}</p>
            <h1 className="admin-page__title">
              {editing ? name || 'Role' : 'Create a role'}
            </h1>
            <p className="admin-page__description">
              Select the actions this role may perform. Permissions are enforced by the server on
              every request, so changes take effect immediately.
            </p>
          </div>
        </div>

        {status === 'loading' ? (
          <div className="admin-loading" role="status">
            <LoaderCircle size={20} className="spin" aria-hidden="true" />
            Loading the permission matrix…
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>The role could not be loaded</strong>
              <p>{loadError}</p>
            </div>
          </div>
        ) : null}

        {status === 'ready' ? (
          <form className="admin-role-editor" onSubmit={handleSubmit} noValidate>
            <section className="admin-panel admin-role-editor__details">
              <header className="admin-panel__header">
                <div>
                  <h2 className="admin-panel__title">Role details</h2>
                  <p className="admin-panel__description">
                    Give the role a clear name that describes the job it supports.
                  </p>
                </div>
                <span className="admin-badge">
                  {selected.size} of {catalog.total} permissions
                </span>
              </header>
              <div className="admin-settings-form">
                <div className="admin-form-grid">
                  <FormField
                    label="Role name"
                    id="role-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setErrors((current) => ({ ...current, name: undefined }));
                    }}
                    error={errors.name}
                    required
                    disabled={!canSave}
                  />
                  <FormField
                    label="Description"
                    id="role-description"
                    as="textarea"
                    rows={2}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setErrors((current) => ({ ...current, description: undefined }));
                    }}
                    error={errors.description}
                    disabled={!canSave}
                  />
                </div>
              </div>
            </section>

            <section className="admin-panel admin-role-editor__matrix">
              <header className="admin-panel__header admin-panel__header--wrap">
                <div>
                  <h2 className="admin-panel__title">
                    <ShieldCheck size={18} aria-hidden="true" /> Permission matrix
                  </h2>
                  <p className="admin-panel__description">
                    Checked actions are allowed. Unchecked actions are denied even if another
                    module is granted.
                  </p>
                </div>
                {canSave ? (
                  <div className="admin-role-editor__tools">
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => selectAll(true)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => selectAll(false)}
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}
              </header>

              {errors.permission_keys ? (
                <div className="admin-alert admin-alert--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <p>{errors.permission_keys}</p>
                </div>
              ) : null}

              <div className="admin-permission-groups">
                {catalog.groups.map((group) => {
                  const columns = ACTION_ORDER.filter((action) =>
                    group.modules.some((module) =>
                      module.actions.some((entry) => entry.key === action),
                    ),
                  );
                  if (!group.modules.length) return null;

                  return (
                    <section className="admin-permission-group" key={group.key}>
                      <h3 className="admin-permission-group__title">{group.label}</h3>
                      <div className="admin-table__scroll">
                        <table className="admin-table admin-permission-matrix">
                          <thead>
                            <tr>
                              <th scope="col">Module</th>
                              <th scope="col">All</th>
                              {columns.map((action) => {
                                const label =
                                  group.modules
                                    .flatMap((module) => module.actions)
                                    .find((entry) => entry.key === action)?.label || action;
                                return (
                                  <th scope="col" key={action}>
                                    {label}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {group.modules.map((module) => {
                              const modulePermissions = module.actions.map(
                                (action) => action.permission,
                              );
                              return (
                                <tr key={module.key}>
                                  <th scope="row">{module.label}</th>
                                  <td className="admin-permission-matrix__toggle">
                                    <ModuleToggle
                                      permissions={modulePermissions}
                                      selected={selected}
                                      onToggle={togglePermissions}
                                    />
                                  </td>
                                  {columns.map((action) => {
                                    const entry = module.actions.find(
                                      (item) => item.key === action,
                                    );
                                    if (!entry) {
                                      return (
                                        <td key={action} className="admin-permission-matrix__empty">
                                          <span aria-hidden="true">—</span>
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={action}>
                                        <input
                                          type="checkbox"
                                          checked={selected.has(entry.permission)}
                                          onChange={() => togglePermission(entry.permission)}
                                          aria-label={`${module.label}: ${entry.label}`}
                                          disabled={!canSave}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>

            <div className="admin-form__actions">
              <Link className="button button--secondary button--md" to="/admin/roles">
                Cancel
              </Link>
              {canSave ? (
                <button type="submit" className="button button--primary button--md" disabled={saving}>
                  {saving ? (
                    <LoaderCircle size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <Save size={16} aria-hidden="true" />
                  )}
                  {saving ? 'Saving…' : editing ? 'Save role' : 'Create role'}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </Container>
    </>
  );
}
