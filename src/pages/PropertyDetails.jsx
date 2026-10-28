import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';
import Container from '../components/common/Container';
import Breadcrumbs from '../components/common/Breadcrumbs';
import PageMeta from '../components/common/PageMeta';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import PropertyGallery from '../components/properties/PropertyGallery';
import PropertySpecifications from '../components/properties/PropertySpecifications';
import RelatedProperties from '../components/properties/RelatedProperties';
import PropertyEnquiryForm from '../components/contact/PropertyEnquiryForm';
import useProperties from '../hooks/useProperties';
import { formatPropertyPrice } from '../services/formatters';
import { propertyTypeLabels, purposeLabels, statusLabels } from '../data/propertyOptions';
import contactDetails from '../data/contact';
import site from '../data/site';

export default function PropertyDetails() {
  const { slug, id } = useParams();
  const { getBySlug, getById } = useProperties();
  const property = id ? getById(id) : getBySlug(slug);

  if (!property) {
    return (
      <>
        <PageMeta
          title="Property not found"
          description="The property you requested could not be found in the EstateVista collection."
          noIndex
        />
        <section className="not-found-page section">
          <Container className="not-found-page__inner">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: 'Properties', to: '/properties' },
                { label: 'Not found' },
              ]}
            />
            <ErrorState
              code="404"
              title="Property not found"
              titleAs="h1"
              description="This property may have been removed, or the link may be incorrect. Explore the current collection to find another place."
              action={
                <Link className="button button--primary button--md" to="/properties">
                  Browse all properties
                </Link>
              }
            />
          </Container>
        </section>
      </>
    );
  }

  const isAvailable = property.status === 'available';
  const description = property.description.slice(0, 170);

  return (
    <>
      <PageMeta
        title={property.title}
        description={description}
        image={property.images?.[0] || site.heroFallbackImage}
      />

      <article className="property-detail">
        <header className="property-detail__header">
          <Container>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: 'Properties', to: '/properties' },
                { label: property.title },
              ]}
            />

            <div className="property-detail__heading">
              <div className="property-detail__heading-main">
                <div className="property-detail__tags">
                  <span>{propertyTypeLabels[property.type] || property.type}</span>
                  <span>{purposeLabels[property.purpose] || property.purpose}</span>
                  <StatusBadge status={property.status} />
                </div>
                <h1 className="property-detail__title">{property.title}</h1>
                <p className="property-detail__location">
                  <MapPin size={17} aria-hidden="true" />
                  {property.location.address}
                </p>
              </div>

              <div className="property-detail__price-block">
                <p className="property-detail__price">{formatPropertyPrice(property)}</p>
                <p className="property-detail__reference">Reference {property.id}</p>
              </div>
            </div>

            {!isAvailable ? (
              <div className="availability-notice" role="status">
                <strong>This property is {statusLabels[property.status]?.toLowerCase()}.</strong>
                <span>
                  It is shown for reference only and is not presented as current available
                  inventory. Explore the collection for available alternatives.
                </span>
                <Link className="text-link" to="/properties">
                  Browse available properties
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </Container>
        </header>

        <section className="property-detail__gallery-section" aria-label="Property images">
          <Container>
            <PropertyGallery key={property.id} images={property.images} title={property.title} />
          </Container>
        </section>

        <section className="property-detail__content section">
          <Container>
            <div className="property-detail__layout">
              <div className="property-detail__main">
                <section className="property-block" aria-labelledby="property-overview-title">
                  <p className="eyebrow">The property</p>
                  <h2 id="property-overview-title" className="property-block__title">
                    About this home
                  </h2>
                  <p className="property-block__copy">{property.description}</p>
                </section>

                <section className="property-block" aria-labelledby="property-specs-title">
                  <h2 id="property-specs-title" className="property-block__title">
                    Specifications
                  </h2>
                  <PropertySpecifications property={property} />
                </section>

                <div className="property-lists">
                  <section className="property-block" aria-labelledby="property-amenities-title">
                    <h2 id="property-amenities-title" className="property-block__title">
                      Amenities
                    </h2>
                    {property.amenities?.length ? (
                      <ul className="check-list">
                        {property.amenities.map((amenity) => (
                          <li key={amenity}>
                            <Check size={15} aria-hidden="true" />
                            {amenity}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="property-block__muted">No amenities have been listed.</p>
                    )}
                  </section>

                  <section className="property-block" aria-labelledby="property-facilities-title">
                    <h2 id="property-facilities-title" className="property-block__title">
                      Facilities
                    </h2>
                    {property.facilities?.length ? (
                      <ul className="check-list">
                        {property.facilities.map((facility) => (
                          <li key={facility}>
                            <Check size={15} aria-hidden="true" />
                            {facility}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="property-block__muted">No additional facilities have been listed.</p>
                    )}
                  </section>
                </div>

                <section className="property-block" aria-labelledby="property-location-title">
                  <h2 id="property-location-title" className="property-block__title">
                    Location
                  </h2>
                  <address className="property-address">
                    {property.location.address}
                    <span>
                      {property.location.area}, {property.location.city}
                    </span>
                  </address>
                  <div className="property-map-placeholder">
                    <MapPin size={22} aria-hidden="true" />
                    <div>
                      <p>Map preview not configured</p>
                      <span>
                        This demonstration listing does not include a verified map location.
                      </span>
                    </div>
                  </div>
                </section>

                <section
                  className="property-block property-block--enquiry"
                  id="enquiry"
                  aria-labelledby="property-enquiry-title"
                >
                  <p className="eyebrow">{isAvailable ? 'Private enquiry' : 'Similar properties'}</p>
                  <h2 id="property-enquiry-title" className="property-block__title">
                    {isAvailable ? 'Arrange a conversation.' : 'Explore available alternatives.'}
                  </h2>
                  {isAvailable ? (
                    <>
                      <p className="property-block__copy">
                        Share a few details and our demonstration form will validate your enquiry.
                        No information is transmitted from this website.
                      </p>
                      <PropertyEnquiryForm property={property} />
                    </>
                  ) : (
                    <div className="unavailable-enquiry">
                      <p>
                        This property is {statusLabels[property.status]?.toLowerCase()} and is not
                        available for a new enquiry. Our team can help you find something similar
                        in the current collection.
                      </p>
                      <div className="unavailable-enquiry__actions">
                        <Link className="button button--primary button--md" to="/properties">
                          Browse available properties
                        </Link>
                        <a className="button button--secondary button--md" href={contactDetails.phone.href}>
                          <Phone size={16} aria-hidden="true" />
                          {contactDetails.phone.label}
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <aside className="property-detail__aside" aria-label="Property enquiry">
                <div className="property-aside-card">
                  <p className="eyebrow">Speak with an advisor</p>
                  <h2 className="property-aside-card__title">
                    {isAvailable ? 'Interested in this property?' : 'Looking for something similar?'}
                  </h2>
                  <p className="property-aside-card__price">{formatPropertyPrice(property)}</p>
                  <p className="property-aside-card__copy">
                    {isAvailable
                      ? 'We can help you understand the detail, arrange a viewing and take the next step.'
                      : 'Our advisors can help you find available properties that match your brief.'}
                  </p>

                  {isAvailable ? (
                    <a className="button button--primary button--full button--md" href="#enquiry">
                      Make an enquiry
                    </a>
                  ) : (
                    <Link className="button button--primary button--full button--md" to="/properties">
                      Browse available
                    </Link>
                  )}

                  <a className="property-aside-card__contact" href={contactDetails.phone.href}>
                    <Phone size={16} aria-hidden="true" />
                    {contactDetails.phone.label}
                  </a>
                  <a className="property-aside-card__contact" href={contactDetails.email.href}>
                    <Mail size={16} aria-hidden="true" />
                    {contactDetails.email.label}
                  </a>

                  <dl className="property-aside-card__facts">
                    <div>
                      <dt>Reference</dt>
                      <dd>{property.id}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{statusLabels[property.status] || property.status}</dd>
                    </div>
                  </dl>

                  <p className="property-aside-card__note">
                    Demonstration listing. Contact details and property data are sample content.
                  </p>
                </div>
              </aside>
            </div>
          </Container>
        </section>

        <RelatedProperties property={property} />
      </article>
    </>
  );
}
