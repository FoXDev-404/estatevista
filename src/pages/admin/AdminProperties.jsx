import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CircleCheck,
  Key,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Tag,
  X,
} from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import PropertyTable from '../../components/admin/PropertyTable';
import DeleteConfirmation from '../../components/admin/DeleteConfirmation';
import useProperties from '../../hooks/useProperties';
import useToast from '../../hooks/useToast';
import { statusOptions } from '../../data/propertyOptions';
import { filterProperties } from '../../services/propertySelectors';

export default function AdminProperties() {
  const {
    properties,
    stats,
    deleteProperty,
    resetProperties,
    importProperties,
    isLoading,
    error,
  } = useProperties();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const filteredProperties = useMemo(() => {
    const searched = filterProperties(
      properties,
      { q: searchTerm },
      { includeUnavailable: true },
    );
    return statusFilter
      ? searched.filter((property) => property.status === statusFilter)
      : searched;
  }, [properties, searchTerm, statusFilter]);

  const statCards = [
    { key: '', label: 'Total records', value: stats.total, icon: Building2 },
    { key: 'available', label: 'Available', value: stats.available, icon: CircleCheck },
    { key: 'sold', label: 'Sold', value: stats.sold, icon: Tag },
    { key: 'rented', label: 'Rented', value: stats.rented, icon: Key },
    { key: 'unavailable', label: 'Unavailable', value: stats.unavailable, icon: AlertCircle },
  ];

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteProperty(pendingDelete.id);
      addToast(`"${pendingDelete.title}" was deleted.`, 'success');
      setPendingDelete(null);
    } catch (error) {
      addToast(error?.message || 'The property could not be deleted.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetProperties();
      addToast('Property data was restored.', 'success');
      setResetOpen(false);
      setSearchTerm('');
      setStatusFilter('');
    } catch (error) {
      addToast(error?.message || 'The property data could not be reset.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
  };

  if (isLoading) {
    return (
      <Container className="admin-page">
        <p className="admin-page__description" role="status">Loading shared property records…</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="admin-page">
        <p className="admin-page__description" role="alert">
          Property records could not be loaded: {error.message}
        </p>
      </Container>
    );
  }

  const handleExport = async () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), properties }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estatevista-properties-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : parsed.properties;
      if (!Array.isArray(records)) throw new Error('The selected file does not contain property records.');
      const proceed = window.confirm(
        `Review complete: ${records.length} records are ready to import. Existing IDs and slugs will be skipped. Continue?`,
      );
      if (!proceed) return;
      const result = await importProperties(records, { conflict: 'skip' });
      addToast(`Imported ${result.inserted} records; skipped ${result.skipped} conflicts.`, 'success');
    } catch (error) {
      addToast(error?.message || 'The property file could not be imported.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Property dashboard"
        description="Property management dashboard for the EstateVista collection."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Property studio</p>
            <h1 className="admin-page__title">Property dashboard</h1>
            <p className="admin-page__description">
              Manage every record in the collection, including sold, rented and unavailable properties.
            </p>
          </div>
          <div className="admin-page__actions">
            <button type="button" className="button button--secondary button--md" onClick={handleExport}>
              Export local data
            </button>
            <label className="button button--secondary button--md">
              {isImporting ? 'Importing…' : 'Import data'}
              <input type="file" accept="application/json,.json" onChange={handleImport} hidden disabled={isImporting} />
            </label>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reset data
            </button>
            <Link className="button button--primary button--md" to="/admin/properties/new">
              <Plus size={17} aria-hidden="true" />
              Add property
            </Link>
          </div>
        </div>

        <div className="admin-stats" aria-label="Property statistics">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isActive = statusFilter === card.key;
            return (
              <button
                type="button"
                key={card.label}
                className={`admin-stat${isActive ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(card.key)}
                aria-pressed={isActive}
              >
                <span className="admin-stat__icon" aria-hidden="true">
                  <Icon size={19} strokeWidth={1.5} />
                </span>
                <span className="admin-stat__value">{card.value}</span>
                <span className="admin-stat__label">{card.label}</span>
              </button>
            );
          })}
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar">
            <div className="admin-toolbar__search">
              <label className="sr-only" htmlFor="admin-property-search">
                Search property records
              </label>
              <Search size={18} className="admin-toolbar__search-icon" aria-hidden="true" />
              <input
                id="admin-property-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by reference, title, city or type…"
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="admin-toolbar__clear"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear property search"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="admin-toolbar__filters">
              <label className="sr-only" htmlFor="admin-status-filter">
                Filter by status
              </label>
              <select
                id="admin-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="admin-toolbar__count" role="status" aria-live="polite">
                {filteredProperties.length} of {properties.length} records
              </span>
            </div>
          </div>

          {properties.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No properties yet"
              description="Add the first property record, or restore the original collection."
              action={
                <div className="admin-empty-actions">
                  <Link className="button button--primary button--md" to="/admin/properties/new">
                    <Plus size={16} aria-hidden="true" />
                    Add property
                  </Link>
                  <button
                    type="button"
                    className="button button--secondary button--md"
                    onClick={() => setResetOpen(true)}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Restore data
                  </button>
                </div>
              }
            />
          ) : filteredProperties.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No records match this search"
              description="Try a different reference, title, location or status."
              action={
                <button type="button" className="button button--secondary button--md" onClick={clearFilters}>
                  Clear search and filters
                </button>
              }
            />
          ) : (
            <PropertyTable properties={filteredProperties} onDelete={setPendingDelete} />
          )}
        </div>

        <p className="admin-page__note">
          Changes are stored only in this browser. Refreshing preserves saved data; clearing site
          data or using another browser does not synchronise records.
        </p>
      </Container>

      <DeleteConfirmation
        open={Boolean(pendingDelete)}
        property={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      <Modal
        open={resetOpen}
        onClose={isResetting ? () => {} : () => setResetOpen(false)}
        title="Reset property data?"
        description="This replaces all properties in local browser storage with the original collection."
        footer={
          <>
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setResetOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger button--md"
              onClick={handleReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : (
                <RotateCcw size={16} aria-hidden="true" />
              )}
              {isResetting ? 'Resetting…' : 'Reset all property data'}
            </button>
          </>
        }
      >
        <div className="reset-confirmation">
          <p>
            Any properties you have created, edited or deleted in this browser will be replaced by
            the original records. This cannot be undone.
          </p>
          <p>Public pages will update immediately after the reset.</p>
        </div>
      </Modal>
    </>
  );
}
