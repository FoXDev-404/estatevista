import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink, MapPin } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import AdminPropertyForm from '../../components/admin/PropertyForm';
import useProperties from '../../hooks/useProperties';
import useToast from '../../hooks/useToast';
import { getPropertyMapEmbedUrl } from '../../services/propertyMap';

export default function AdminPropertyEdit() {
  const { id } = useParams();
  const { getById, updateProperty, properties } = useProperties();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const property = getById(id);
  const mapEmbedUrl = property ? getPropertyMapEmbedUrl(property) : null;

  if (!property) {
    return (
      <>
        <PageMeta title="Property not found" description="The property record could not be found." noIndex />
        <Container className="admin-page">
          <Link className="back-link" to="/admin/properties">
            <ChevronLeft size={16} aria-hidden="true" />
            Back to dashboard
          </Link>
          <ErrorState
            code="404"
            title="Property record not found"
            titleAs="h1"
            description="This record may have been deleted in another tab. Return to the dashboard to manage the current collection."
            action={
              <Link className="button button--primary button--md" to="/admin/properties">
                Return to dashboard
              </Link>
            }
          />
        </Container>
      </>
    );
  }

  const handleSubmit = async (record) => {
    const updated = updateProperty(property.id, record);
    addToast(`Changes to "${updated.title}" were saved.`, 'success');
    navigate('/admin/properties');
  };

  return (
    <>
      <PageMeta
        title={`Edit ${property.title}`}
        description="Edit a property record in the EstateVista local property studio."
        noIndex
      />
      <Container className="admin-page admin-form-page">
        <Link className="back-link" to="/admin/properties">
          <ChevronLeft size={16} aria-hidden="true" />
          Back to dashboard
        </Link>

        <div className="admin-page__header admin-page__header--edit">
          <div>
            <p className="eyebrow">Edit record · {property.id}</p>
            <h1 className="admin-page__title">{property.title}</h1>
            <p className="admin-page__description">
              Update this record below. Successful changes propagate immediately to the public
              collection.
            </p>
            <div className="admin-page__meta">
              <StatusBadge status={property.status} />
              <span>{property.location?.area}, {property.location?.city}</span>
            </div>
          </div>
          <div className="admin-page__actions">
            <Link
              className="button button--secondary button--md"
              to={`/properties/${property.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              View public page
            </Link>
          </div>
        </div>

        <div className="admin-map-card" style={{ marginBottom: '1.5rem' }}>
          <div className="admin-map-card__header">
            <div>
              <p className="eyebrow">Location map</p>
              <h2 className="admin-page__subtitle">Property location</h2>
            </div>
            <span className="admin-map-card__meta">
              <MapPin size={16} aria-hidden="true" />
              {property.location?.area}, {property.location?.city}
            </span>
          </div>

          {mapEmbedUrl ? (
            <iframe
              className="admin-map-card__frame"
              src={mapEmbedUrl}
              title={`${property.title} location map`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="admin-map-card__placeholder">
              <MapPin size={20} aria-hidden="true" />
              <p>Map preview not configured for this property.</p>
            </div>
          )}
        </div>

        <AdminPropertyForm
          key={property.id}
          mode="edit"
          property={property}
          existingProperties={properties}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/properties')}
          submitLabel="Save changes"
        />
      </Container>
    </>
  );
}
