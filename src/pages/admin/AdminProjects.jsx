import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Building2, LoaderCircle, Plus, Search, X } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import ProjectCard from '../../components/admin/inventory/ProjectCard';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import inventoryApiService from '../../services/inventoryApiService';
import { projectStatusOptions, projectTypeOptions } from '../../services/inventorySelectors';

export default function AdminProjects() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('projects.create');
  const canEdit = hasPermission('projects.edit');
  const canDelete = hasPermission('projects.delete');

  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setLoadError('');
      try {
        const result = await inventoryApiService.listProjects({
          search: debouncedSearch,
          type,
          status: projectStatus,
        });
        if (ignore) return;
        setProjects(result.data);
        setMeta(result.meta);
        setStatus('ready');
      } catch (error) {
        if (ignore) return;
        setLoadError(error.message || 'Projects could not be loaded.');
        setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [debouncedSearch, type, projectStatus, reloadKey]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await inventoryApiService.deleteProject(deleteTarget.id);
      addToast(`"${deleteTarget.name}" was archived and removed from the list.`, 'success');
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDeleteError(error.message || 'The project could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search || type || projectStatus);

  return (
    <>
      <PageMeta
        title="Projects"
        description="Manage development projects, buildings, floors and unit inventory."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Projects</h1>
            <p className="admin-page__description">
              Each project groups its buildings, floors and sellable units. Counts update as units
              are added or sold.
            </p>
          </div>
          {canCreate ? (
            <Link className="button button--primary button--md" to="/admin/projects/new">
              <Plus size={16} aria-hidden="true" />
              New project
            </Link>
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
                placeholder="Search by name, code or city"
                aria-label="Search projects"
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
                value={type}
                onChange={(event) => setType(event.target.value)}
                aria-label="Filter by project type"
              >
                <option value="">All types</option>
                {projectTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={projectStatus}
                onChange={(event) => setProjectStatus(event.target.value)}
                aria-label="Filter by project status"
              >
                <option value="">All statuses</option>
                {projectStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} project{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading projects…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Projects could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !projects.length ? (
            <EmptyState
              icon={Building2}
              title="No projects found"
              description={
                hasFilters
                  ? 'Try a different search, type or status filter.'
                  : 'Create the first project to start adding buildings and units.'
              }
              action={
                canCreate && !hasFilters ? (
                  <Link className="button button--primary button--md" to="/admin/projects/new">
                    <Plus size={16} aria-hidden="true" />
                    New project
                  </Link>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && projects.length ? (
            <div className="admin-project-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onDelete={(row) => {
                    setDeleteError('');
                    setDeleteTarget(row);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Container>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete project"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Projects with units cannot be deleted — archive them instead by changing their status.`
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
              {deleting ? 'Deleting…' : 'Delete project'}
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
            Deleting hides the project from the workspace. Set its status to Archived instead when
            you want to keep it visible in reports.
          </p>
        )}
      </Modal>
    </>
  );
}
