import { useEffect, useState } from 'react';
import { AlertCircle, FileText, LoaderCircle, Plus, Search, X } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import UnitTable from '../../components/admin/inventory/UnitTable';
import UnitFormModal from '../../components/admin/inventory/UnitFormModal';
import UnitStatusModal from '../../components/admin/inventory/UnitStatusModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import { unitStatusOptions } from '../../services/inventorySelectors';

export default function AdminUnits() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const canCreate = hasPermission('units.create');
  const canEdit = hasPermission('units.edit');
  const canDelete = hasPermission('units.delete');

  const [projects, setProjects] = useState([]);
  const [unitTypes, setUnitTypes] = useState([]);

  const [units, setUnits] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const [unitForm, setUnitForm] = useState({ open: false, unit: null });
  const [statusUnit, setStatusUnit] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      inventoryApiService.listProjects({}),
      adminApiService.getLookups().catch(() => ({ unit_types: [] })),
    ])
      .then(([projectResult, lookupData]) => {
        if (ignore) return;
        setProjects(projectResult.data);
        setUnitTypes(lookupData.unit_types || []);
      })
      .catch(() => {
        if (!ignore) {
          setProjects([]);
          setUnitTypes([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    inventoryApiService
      .listUnits({
        search: debouncedSearch,
        project_id: projectFilter,
        status: statusFilter,
        unit_type_id: typeFilter,
        page,
        limit: 25,
      })
      .then((result) => {
        if (ignore) return;
        setUnits(result.data);
        setMeta(result.meta);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'Units could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, projectFilter, statusFilter, typeFilter, page, reloadKey]);

  function resetPage() {
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await inventoryApiService.deleteUnit(deleteTarget.id);
      addToast(`Unit ${deleteTarget.unit_number} was deleted.`, 'success');
      setDeleteTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDeleteError(error.message || 'The unit could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search || projectFilter || statusFilter || typeFilter);

  return (
    <>
      <PageMeta
        title="Units"
        description="Search the full unit inventory across every project."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1 className="admin-page__title">Units</h1>
            <p className="admin-page__description">
              Every sellable or rentable unit across projects. Open a project to manage its
              buildings and bulk generation.
            </p>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="button button--primary button--md"
              onClick={() => setUnitForm({ open: true, unit: null })}
            >
              <Plus size={16} aria-hidden="true" />
              New unit
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
                placeholder="Search by unit number"
                aria-label="Search units"
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
                value={projectFilter}
                onChange={(event) => {
                  setProjectFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by project"
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
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
                {unitStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by unit type"
              >
                <option value="">All types</option>
                {unitTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {meta ? (
                <span className="admin-toolbar__count">
                  {meta.total} unit{meta.total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>

          {status === 'loading' ? (
            <div className="admin-loading" role="status">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />
              Loading units…
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="admin-alert admin-alert--danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div>
                <strong>Units could not be loaded</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : null}

          {status === 'ready' && !units.length ? (
            <EmptyState
              icon={FileText}
              title="No units found"
              description={
                hasFilters
                  ? 'Try a different search or filter.'
                  : 'Add units from a project to build the inventory.'
              }
              action={
                canCreate && !hasFilters ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setUnitForm({ open: true, unit: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    New unit
                  </button>
                ) : null
              }
            />
          ) : null}

          {status === 'ready' && units.length ? (
            <>
              <UnitTable
                units={units}
                showProject
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={(unit) => setUnitForm({ open: true, unit })}
                onStatus={(unit) => setStatusUnit(unit)}
                onDelete={(unit) => {
                  setDeleteError('');
                  setDeleteTarget(unit);
                }}
              />
              <div className="admin-pagination">
                <Pagination
                  page={meta?.page || 1}
                  totalPages={meta?.pages || 1}
                  onPageChange={setPage}
                  label="Unit pagination"
                />
              </div>
            </>
          ) : null}
        </div>
      </Container>

      {unitForm.open ? (
        <UnitFormModal
          key={unitForm.unit?.id || 'new'}
          onClose={() => setUnitForm({ open: false, unit: null })}
          onSaved={() => setReloadKey((value) => value + 1)}
          projects={projects}
          unitTypes={unitTypes}
          initialUnit={unitForm.unit}
        />
      ) : null}

      {statusUnit ? (
        <UnitStatusModal
          key={statusUnit.id}
          unit={statusUnit}
          onClose={() => setStatusUnit(null)}
          onSaved={() => setReloadKey((value) => value + 1)}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete unit"
        description={
          deleteTarget
            ? `Delete unit ${deleteTarget.unit_number}? Units with an active reservation, sale or lease cannot be deleted.`
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
              {deleting ? 'Deleting…' : 'Delete unit'}
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
          <p className="admin-modal-note">This action is recorded in the audit log.</p>
        )}
      </Modal>
    </>
  );
}
