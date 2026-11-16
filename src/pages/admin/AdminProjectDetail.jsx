import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/properties/Pagination';
import UnitTable from '../../components/admin/inventory/UnitTable';
import UnitFormModal from '../../components/admin/inventory/UnitFormModal';
import UnitStatusModal from '../../components/admin/inventory/UnitStatusModal';
import GenerateUnitsModal from '../../components/admin/inventory/GenerateUnitsModal';
import BuildingFormModal from '../../components/admin/inventory/BuildingFormModal';
import FloorFormModal from '../../components/admin/inventory/FloorFormModal';
import DocumentUploadModal from '../../components/admin/inventory/DocumentUploadModal';
import { useAuth } from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { formatDate, formatNumber, formatPrice } from '../../services/formatters';
import { formatDateTime } from '../../services/adminFormatters';
import adminApiService from '../../services/adminApiService';
import inventoryApiService from '../../services/inventoryApiService';
import {
  labelFor,
  projectStatusOptions,
  projectTypeOptions,
  statusTone,
  unitStatusOptions,
} from '../../services/inventorySelectors';

function factValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

function bytesLabel(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'buildings', label: 'Buildings & floors' },
  { id: 'units', label: 'Units' },
  { id: 'documents', label: 'Documents' },
];

export default function AdminProjectDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const canEditProject = hasPermission('projects.edit');
  const canCreateUnit = hasPermission('units.create');
  const canEditUnit = hasPermission('units.edit');
  const canDeleteUnit = hasPermission('units.delete');

  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [projectReloadKey, setProjectReloadKey] = useState(0);
  const [tab, setTab] = useState('overview');
  const [unitTypes, setUnitTypes] = useState([]);

  const [units, setUnits] = useState([]);
  const [unitsMeta, setUnitsMeta] = useState(null);
  const [unitsStatus, setUnitsStatus] = useState('loading');
  const [unitsSearch, setUnitsSearch] = useState('');
  const [unitsFilterStatus, setUnitsFilterStatus] = useState('');
  const [unitsPage, setUnitsPage] = useState(1);
  const [unitsReloadKey, setUnitsReloadKey] = useState(0);
  const debouncedUnitsSearch = useDebouncedValue(unitsSearch);

  const [documents, setDocuments] = useState([]);
  const [documentsStatus, setDocumentsStatus] = useState('loading');
  const [documentsReloadKey, setDocumentsReloadKey] = useState(0);

  const [unitForm, setUnitForm] = useState({ open: false, unit: null });
  const [statusUnit, setStatusUnit] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [buildingModal, setBuildingModal] = useState({ open: false, building: null });
  const [floorBuilding, setFloorBuilding] = useState(null);
  const [documentOpen, setDocumentOpen] = useState(false);

  const [deleteUnitTarget, setDeleteUnitTarget] = useState(null);
  const [deleteBuildingTarget, setDeleteBuildingTarget] = useState(null);
  const [deleteFloorTarget, setDeleteFloorTarget] = useState(null);
  const [deleteDocumentTarget, setDeleteDocumentTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let ignore = false;

    inventoryApiService
      .getProject(id)
      .then((data) => {
        if (ignore) return;
        setProject(data);
        setLoadError('');
        setStatus('ready');
      })
      .catch((error) => {
        if (ignore) return;
        setLoadError(error.message || 'The project could not be loaded.');
        setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [id, projectReloadKey]);

  useEffect(() => {
    let ignore = false;
    adminApiService
      .getLookups()
      .then((data) => {
        if (!ignore) setUnitTypes(data.unit_types || []);
      })
      .catch(() => {
        if (!ignore) setUnitTypes([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!project) return undefined;
    let ignore = false;

    inventoryApiService
      .listUnits({
        project_id: project.id,
        search: debouncedUnitsSearch,
        status: unitsFilterStatus,
        page: unitsPage,
        limit: 25,
      })
      .then((result) => {
        if (ignore) return;
        setUnits(result.data);
        setUnitsMeta(result.meta);
        setUnitsStatus('ready');
      })
      .catch(() => {
        if (ignore) return;
        setUnitsStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [project, debouncedUnitsSearch, unitsFilterStatus, unitsPage, unitsReloadKey]);

  useEffect(() => {
    if (!project) return undefined;
    let ignore = false;

    inventoryApiService
      .listDocuments({ owner_type: 'project', owner_id: project.id })
      .then((rows) => {
        if (ignore) return;
        setDocuments(rows);
        setDocumentsStatus('ready');
      })
      .catch(() => {
        if (ignore) return;
        setDocumentsStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, [project, documentsReloadKey]);

  function refreshInventory() {
    setUnitsReloadKey((value) => value + 1);
    setProjectReloadKey((value) => value + 1);
  }

  async function confirmDelete() {
    const target =
      deleteUnitTarget || deleteBuildingTarget || deleteFloorTarget || deleteDocumentTarget;
    if (!target) return;

    setDeleting(true);
    setDeleteError('');
    try {
      if (deleteUnitTarget) {
        await inventoryApiService.deleteUnit(deleteUnitTarget.id);
        addToast(`Unit ${deleteUnitTarget.unit_number} was deleted.`, 'success');
        setDeleteUnitTarget(null);
        refreshInventory();
      } else if (deleteBuildingTarget) {
        await inventoryApiService.deleteBuilding(project.id, deleteBuildingTarget.id);
        addToast(`Building ${deleteBuildingTarget.code} was deleted.`, 'success');
        setDeleteBuildingTarget(null);
        setProjectReloadKey((value) => value + 1);
      } else if (deleteFloorTarget) {
        await inventoryApiService.deleteFloor(
          project.id,
          deleteFloorTarget.building.id,
          deleteFloorTarget.floor.id,
        );
        addToast(`Floor ${deleteFloorTarget.floor.number} was removed.`, 'success');
        setDeleteFloorTarget(null);
        setProjectReloadKey((value) => value + 1);
      } else if (deleteDocumentTarget) {
        await inventoryApiService.deleteDocument(deleteDocumentTarget.id);
        addToast(`"${deleteDocumentTarget.file_name}" was deleted.`, 'success');
        setDeleteDocumentTarget(null);
        setDocumentsReloadKey((value) => value + 1);
      }
    } catch (error) {
      setDeleteError(error.message || 'The record could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteUnitTarget(null);
    setDeleteBuildingTarget(null);
    setDeleteFloorTarget(null);
    setDeleteDocumentTarget(null);
    setDeleteError('');
  }

  if (status === 'loading' && !project) {
    return (
      <Container className="admin-page">
        <div className="admin-loading" role="status">
          <LoaderCircle size={20} className="spin" aria-hidden="true" />
          Loading project…
        </div>
      </Container>
    );
  }

  if (status === 'error' || !project) {
    return (
      <Container className="admin-page">
        <div className="admin-alert admin-alert--danger" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Project could not be loaded</strong>
            <p>{loadError}</p>
          </div>
        </div>
        <Link className="button button--secondary button--md" to="/admin/projects">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to projects
        </Link>
      </Container>
    );
  }

  const place = [project.city, project.location].filter(Boolean).join(', ');
  const buildings = project.buildings || [];
  const currency = project.currency || 'USD';
  const deleteTarget =
    deleteUnitTarget || deleteBuildingTarget || deleteFloorTarget || deleteDocumentTarget;

  const deleteCopy = deleteUnitTarget
    ? `Delete unit ${deleteUnitTarget.unit_number}? Units with an active reservation, sale or lease cannot be deleted.`
    : deleteBuildingTarget
      ? `Delete building ${deleteBuildingTarget.code}? Buildings that still contain units cannot be deleted.`
      : deleteFloorTarget
        ? `Remove floor ${deleteFloorTarget.floor.number} from building ${deleteFloorTarget.building.code}?`
        : deleteDocumentTarget
          ? `Delete "${deleteDocumentTarget.file_name}"? The stored file is removed as well.`
          : '';

  return (
    <>
      <PageMeta title={project.name} description={project.description || 'Project details'} noIndex />
      <Container className="admin-page">
        <div className="admin-page__header admin-page__header--edit">
          <div>
            <Link className="admin-form-page__reference" to="/admin/projects">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to projects
            </Link>
            <div className="admin-project-detail__title">
              <h1 className="admin-page__title">{project.name}</h1>
              <span className={`admin-badge admin-badge--${statusTone(project.status)}`}>
                {labelFor(projectStatusOptions, project.status)}
              </span>
            </div>
            <p className="admin-page__description">
              {project.code || project.number} · {labelFor(projectTypeOptions, project.type)}
              {place ? ` · ${place}` : ''}
            </p>
          </div>
          {canEditProject ? (
            <Link
              className="button button--secondary button--md"
              to={`/admin/projects/${project.id}/edit`}
            >
              <Pencil size={16} aria-hidden="true" />
              Edit project
            </Link>
          ) : null}
        </div>

        <div className="admin-stats">
          <div className="admin-stat">
            <span className="admin-stat__icon">
              <Layers size={18} aria-hidden="true" />
            </span>
            <span className="admin-stat__value">{buildings.length}</span>
            <span className="admin-stat__label">Buildings</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon">
              <FileText size={18} aria-hidden="true" />
            </span>
            <span className="admin-stat__value">{project.units_count || 0}</span>
            <span className="admin-stat__label">Units</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon">
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <span className="admin-stat__value">{project.available_units || 0}</span>
            <span className="admin-stat__label">Available</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__icon">
              <FileText size={18} aria-hidden="true" />
            </span>
            <span className="admin-stat__value">{project.sold_units || 0}</span>
            <span className="admin-stat__label">Sold</span>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-tabs" role="tablist" aria-label="Project sections">
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
                {entry.id === 'buildings' ? ` (${buildings.length})` : null}
                {entry.id === 'units' ? ` (${project.units_count || 0})` : null}
                {entry.id === 'documents' ? ` (${documents.length})` : null}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="admin-project-overview">
              {project.description ? (
                <p className="admin-project-overview__description">{project.description}</p>
              ) : null}

              <div className="admin-detail-grid">
                <div>
                  <span>Project number</span>
                  <strong>{project.number}</strong>
                </div>
                <div>
                  <span>Project code</span>
                  <strong>{factValue(project.code)}</strong>
                </div>
                <div>
                  <span>Type</span>
                  <strong>{labelFor(projectTypeOptions, project.type)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{labelFor(projectStatusOptions, project.status)}</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>{factValue(project.branch?.name)}</strong>
                </div>
                <div>
                  <span>Project manager</span>
                  <strong>{factValue(project.project_manager?.name)}</strong>
                </div>
                <div>
                  <span>City</span>
                  <strong>{factValue(project.city)}</strong>
                </div>
                <div>
                  <span>Area or locality</span>
                  <strong>{factValue(project.location)}</strong>
                </div>
                <div className="admin-detail-grid__full">
                  <span>Address</span>
                  <strong>{factValue(project.address)}</strong>
                </div>
                <div>
                  <span>Budget</span>
                  <strong>{Number(project.budget) > 0 ? formatPrice(project.budget, currency) : '—'}</strong>
                </div>
                <div>
                  <span>Booking amount</span>
                  <strong>
                    {Number(project.booking_amount) > 0
                      ? formatPrice(project.booking_amount, currency)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Land area</span>
                  <strong>
                    {project.land_area
                      ? `${formatNumber(project.land_area)} ${project.land_area_unit}`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Currency</span>
                  <strong>{currency}</strong>
                </div>
                <div>
                  <span>Start date</span>
                  <strong>{project.start_date ? formatDate(project.start_date) : '—'}</strong>
                </div>
                <div>
                  <span>Expected completion</span>
                  <strong>
                    {project.expected_completion_date
                      ? formatDate(project.expected_completion_date)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Actual completion</span>
                  <strong>
                    {project.actual_completion_date
                      ? formatDate(project.actual_completion_date)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span>Website</span>
                  <strong>{project.is_published ? 'Published' : 'Not published'}</strong>
                </div>
              </div>

              {project.amenities?.length ? (
                <div className="admin-project-overview__block">
                  <h3>Amenities</h3>
                  <div className="admin-tag-list">
                    {project.amenities.map((amenity) => (
                      <span key={amenity} className="admin-tag">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {project.payment_note ? (
                <div className="admin-project-overview__block">
                  <h3>Payment note</h3>
                  <p className="admin-modal-note">{project.payment_note}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'buildings' ? (
            <>
              <div className="admin-panel__header admin-panel__header--wrap">
                <div>
                  <h2 className="admin-panel__title">Buildings and floors</h2>
                  <p className="admin-panel__description">
                    Floors are created with the building and can be extended as work progresses.
                  </p>
                </div>
                {canEditProject ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setBuildingModal({ open: true, building: null })}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add building
                  </button>
                ) : null}
              </div>

              {!buildings.length ? (
                <EmptyState
                  icon={Layers}
                  title="No buildings yet"
                  description="Add a building to create its floors, then generate units for each floor."
                  action={
                    canEditProject ? (
                      <button
                        type="button"
                        className="button button--primary button--md"
                        onClick={() => setBuildingModal({ open: true, building: null })}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Add building
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="admin-building-list">
                  {buildings.map((building) => (
                    <article key={building.id} className="admin-building">
                      <div className="admin-building__header">
                        <div>
                          <h3>
                            <span className="admin-table__code">{building.code}</span>
                            {building.name}
                          </h3>
                          <p>
                            {building.floors.length} floor{building.floors.length === 1 ? '' : 's'} ·{' '}
                            {building.units_count || 0} unit{building.units_count === 1 ? '' : 's'}
                          </p>
                        </div>
                        {canEditProject ? (
                          <div className="table-actions">
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => setFloorBuilding(building)}
                            >
                              <Plus size={15} aria-hidden="true" />
                              <span>Add floor</span>
                            </button>
                            <button
                              type="button"
                              className="table-action"
                              onClick={() => setBuildingModal({ open: true, building })}
                            >
                              <Pencil size={15} aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="table-action table-action--danger"
                              onClick={() => {
                                setDeleteError('');
                                setDeleteBuildingTarget(building);
                              }}
                              disabled={building.units_count > 0}
                              title={
                                building.units_count > 0
                                  ? 'Buildings that still contain units cannot be deleted.'
                                  : undefined
                              }
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {building.floors.length ? (
                        <ul className="admin-floor-list">
                          {building.floors.map((floor) => (
                            <li key={floor.id} className="admin-floor">
                              <span>
                                Floor {floor.number}
                                {floor.name ? ` — ${floor.name}` : ''}
                              </span>
                              <span className="admin-floor__meta">
                                {floor.units_count} unit{floor.units_count === 1 ? '' : 's'}
                                {canEditProject && floor.units_count === 0 ? (
                                  <button
                                    type="button"
                                    className="admin-floor__remove"
                                    onClick={() => {
                                      setDeleteError('');
                                      setDeleteFloorTarget({ building, floor });
                                    }}
                                    aria-label={`Remove floor ${floor.number} from building ${building.code}`}
                                  >
                                    <X size={13} aria-hidden="true" />
                                  </button>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-modal-note">No floors yet. Add the first floor above.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {tab === 'units' ? (
            <>
              <div className="admin-panel__header admin-panel__header--wrap">
                <div>
                  <h2 className="admin-panel__title">Units</h2>
                  <p className="admin-panel__description">
                    Every unit belongs to this project. Status changes are recorded in history.
                  </p>
                </div>
                <div className="admin-panel__actions">
                  {canCreateUnit ? (
                    <>
                      <button
                        type="button"
                        className="button button--secondary button--md"
                        onClick={() => setGenerateOpen(true)}
                        disabled={!buildings.length}
                        title={
                          buildings.length
                            ? undefined
                            : 'Add a building with floors before generating units.'
                        }
                      >
                        <Wand2 size={16} aria-hidden="true" />
                        Generate units
                      </button>
                      <button
                        type="button"
                        className="button button--primary button--md"
                        onClick={() => setUnitForm({ open: true, unit: null })}
                      >
                        <Plus size={16} aria-hidden="true" />
                        Add unit
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="admin-toolbar">
                <label className="admin-toolbar__search">
                  <Search size={16} className="admin-toolbar__search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={unitsSearch}
                    onChange={(event) => {
                      setUnitsSearch(event.target.value);
                      setUnitsPage(1);
                    }}
                    placeholder="Search by unit number"
                    aria-label="Search units"
                  />
                  {unitsSearch ? (
                    <button
                      type="button"
                      className="admin-toolbar__clear"
                      onClick={() => {
                        setUnitsSearch('');
                        setUnitsPage(1);
                      }}
                      aria-label="Clear unit search"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </label>
                <div className="admin-toolbar__filters">
                  <select
                    value={unitsFilterStatus}
                    onChange={(event) => {
                      setUnitsFilterStatus(event.target.value);
                      setUnitsPage(1);
                    }}
                    aria-label="Filter units by status"
                  >
                    <option value="">All statuses</option>
                    {unitStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {unitsMeta ? (
                    <span className="admin-toolbar__count">
                      {unitsMeta.total} unit{unitsMeta.total === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              </div>

              {unitsStatus === 'loading' ? (
                <div className="admin-loading" role="status">
                  <LoaderCircle size={20} className="spin" aria-hidden="true" />
                  Loading units…
                </div>
              ) : null}

              {unitsStatus === 'error' ? (
                <div className="admin-alert admin-alert--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <p>Units could not be loaded.</p>
                </div>
              ) : null}

              {unitsStatus === 'ready' && !units.length ? (
                <EmptyState
                  icon={FileText}
                  title="No units found"
                  description={
                    unitsSearch || unitsFilterStatus
                      ? 'Try a different search or status filter.'
                      : 'Add a single unit or generate a numbered set for the building.'
                  }
                />
              ) : null}

              {unitsStatus === 'ready' && units.length ? (
                <>
                  <UnitTable
                    units={units}
                    canEdit={canEditUnit}
                    canDelete={canDeleteUnit}
                    onEdit={(unit) => setUnitForm({ open: true, unit })}
                    onStatus={(unit) => setStatusUnit(unit)}
                    onDelete={(unit) => {
                      setDeleteError('');
                      setDeleteUnitTarget(unit);
                    }}
                  />
                  <div className="admin-pagination">
                    <Pagination
                      page={unitsMeta?.page || 1}
                      totalPages={unitsMeta?.pages || 1}
                      onPageChange={setUnitsPage}
                      label="Project units pagination"
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'documents' ? (
            <>
              <div className="admin-panel__header admin-panel__header--wrap">
                <div>
                  <h2 className="admin-panel__title">Documents</h2>
                  <p className="admin-panel__description">
                    Permits, layouts and contracts attached to this project. Files are stored
                    privately.
                  </p>
                </div>
                {canEditProject ? (
                  <button
                    type="button"
                    className="button button--primary button--md"
                    onClick={() => setDocumentOpen(true)}
                  >
                    <Upload size={16} aria-hidden="true" />
                    Upload document
                  </button>
                ) : null}
              </div>

              {documentsStatus === 'loading' ? (
                <div className="admin-loading" role="status">
                  <LoaderCircle size={20} className="spin" aria-hidden="true" />
                  Loading documents…
                </div>
              ) : null}

              {documentsStatus === 'error' ? (
                <div className="admin-alert admin-alert--danger" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <p>Documents could not be loaded.</p>
                </div>
              ) : null}

              {documentsStatus === 'ready' && !documents.length ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Upload the first permit, layout plan or brochure for this project."
                />
              ) : null}

              {documentsStatus === 'ready' && documents.length ? (
                <div className="admin-table__scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">File</th>
                        <th scope="col">Category</th>
                        <th scope="col">Size</th>
                        <th scope="col">Uploaded</th>
                        {canEditProject ? (
                          <th scope="col" className="admin-table__actions-head">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <th scope="row">
                            <span className="admin-table__title">{document.file_name}</span>
                            <span className="admin-table__muted">{document.mime_type || 'File'}</span>
                          </th>
                          <td>{document.category || '—'}</td>
                          <td>{bytesLabel(document.size_bytes)}</td>
                          <td>{formatDateTime(document.created_at)}</td>
                          {canEditProject ? (
                            <td>
                              <div className="table-actions">
                                <button
                                  type="button"
                                  className="table-action table-action--danger"
                                  onClick={() => {
                                    setDeleteError('');
                                    setDeleteDocumentTarget(document);
                                  }}
                                >
                                  <Trash2 size={15} aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Container>

      {unitForm.open ? (
        <UnitFormModal
          key={unitForm.unit?.id || 'new'}
          onClose={() => setUnitForm({ open: false, unit: null })}
          onSaved={refreshInventory}
          projects={[project]}
          unitTypes={unitTypes}
          initialUnit={unitForm.unit}
          fixedProjectId={project.id}
        />
      ) : null}

      {statusUnit ? (
        <UnitStatusModal
          key={statusUnit.id}
          unit={statusUnit}
          onClose={() => setStatusUnit(null)}
          onSaved={refreshInventory}
        />
      ) : null}

      {generateOpen ? (
        <GenerateUnitsModal
          project={project}
          buildings={buildings}
          unitTypes={unitTypes}
          onClose={() => setGenerateOpen(false)}
          onSaved={refreshInventory}
        />
      ) : null}

      {buildingModal.open ? (
        <BuildingFormModal
          key={buildingModal.building?.id || 'new'}
          projectId={project.id}
          initialBuilding={buildingModal.building}
          onClose={() => setBuildingModal({ open: false, building: null })}
          onSaved={() => setProjectReloadKey((value) => value + 1)}
        />
      ) : null}

      {floorBuilding ? (
        <FloorFormModal
          key={floorBuilding.id}
          projectId={project.id}
          building={floorBuilding}
          onClose={() => setFloorBuilding(null)}
          onSaved={() => setProjectReloadKey((value) => value + 1)}
        />
      ) : null}

      {documentOpen ? (
        <DocumentUploadModal
          projectId={project.id}
          onClose={() => setDocumentOpen(false)}
          onSaved={() => setDocumentsReloadKey((value) => value + 1)}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        title="Confirm delete"
        description={deleteCopy}
        size="small"
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={closeDeleteModal}
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
              {deleting ? 'Deleting…' : 'Delete'}
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
