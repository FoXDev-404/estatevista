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
  } = useProperties();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
      deleteProperty(pendingDelete.id);
      addToast(`"${pendingDelete.title}" was deleted.`, 'success');
      setPendingDelete(null);
    } catch (error) {
      addToast(error?.message || 'The property could not be deleted.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReset = () => {
    setIsResetting(true);
    try {
      resetProperties();
      addToast('Demonstration property data was restored.', 'success');
      setResetOpen(false);
      setSearchTerm('');
      setStatusFilter('');
    } catch (error) {
      addToast(error?.message || 'Demonstration data could not be reset.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
  };

  return (
    <>
      <PageMeta
        title="Property dashboard"
        description="Local property management dashboard for the EstateVista demonstration."
        noIndex
      />
      <Container className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Property studio</p>
            <h1 className="admin-page__title">Property dashboard</h1>
            <p className="admin-page__description">
              Manage every record in the local demonstration collection, including sold, rented
              and unavailable properties.
            </p>
          </div>
          <div className="admin-page__actions">
            <button
              type="button"
              className="button button--secondary button--md"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reset demo data
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
              description="Add the first property record, or restore the original demonstration collection."
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
                    Restore demo data
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
        title="Reset demonstration data?"
        description="This replaces all properties in local browser storage with the original sample collection."
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
            the original sample records. This cannot be undone.
          </p>
          <p>Public pages will update immediately after the reset.</p>
        </div>
      </Modal>
    </>
  );
}
