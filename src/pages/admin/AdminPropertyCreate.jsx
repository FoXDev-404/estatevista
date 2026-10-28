import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Hash } from 'lucide-react';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import AdminPropertyForm from '../../components/admin/PropertyForm';
import useProperties from '../../hooks/useProperties';
import useToast from '../../hooks/useToast';
import { generatePropertyId } from '../../services/propertyRepository';

export default function AdminPropertyCreate() {
  const { properties, createProperty } = useProperties();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (record) => {
    const payload = { ...record };
    delete payload.id; // The repository generates a stable unique ID.
    const created = createProperty(payload);
    addToast(`"${created.title}" was created and published to the marketplace.`, 'success');
    navigate('/admin/properties');
  };

  return (
    <>
      <PageMeta
        title="Add a property"
        description="Create a new property record in the EstateVista local property studio."
        noIndex
      />
      <Container className="admin-page admin-form-page">
        <Link className="back-link" to="/admin/properties">
          <ChevronLeft size={16} aria-hidden="true" />
          Back to dashboard
        </Link>

        <div className="admin-page__header">
          <div>
            <p className="eyebrow">New record</p>
            <h1 className="admin-page__title">Add a property</h1>
            <p className="admin-page__description">
              Create a complete property record. It will appear immediately across the public
              marketplace when its status is available.
            </p>
          </div>
          <div className="admin-form-page__reference">
            <Hash size={16} aria-hidden="true" />
            <span>
              Next reference <strong>{generatePropertyId(properties)}</strong>
            </span>
          </div>
        </div>

        <AdminPropertyForm
          mode="create"
          existingProperties={properties}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/properties')}
          submitLabel="Create property"
        />
      </Container>
    </>
  );
}
