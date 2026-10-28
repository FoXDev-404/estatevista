import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import {
  formatPropertyPrice,
} from '../../services/formatters';
import {
  propertyTypeLabels,
  purposeLabels,
} from '../../data/propertyOptions';

function Flags({ property }) {
  return (
    <div className="table-flags">
      {property.featured ? <span className="table-flag table-flag--featured">Featured</span> : null}
      {property.trending ? <span className="table-flag">Trending</span> : null}
      {!property.featured && !property.trending ? (
        <span className="table-flag table-flag--muted">—</span>
      ) : null}
    </div>
  );
}

function RowActions({ property, onDelete }) {
  return (
    <div className="table-actions">
      <Link
        className="table-action"
        to={`/admin/properties/${property.id}/edit`}
        aria-label={`Edit ${property.title}`}
      >
        <Pencil size={15} aria-hidden="true" />
        <span>Edit</span>
      </Link>
      <button
        type="button"
        className="table-action table-action--danger"
        onClick={() => onDelete(property)}
        aria-label={`Delete ${property.title}`}
      >
        <Trash2 size={15} aria-hidden="true" />
        <span>Delete</span>
      </button>
    </div>
  );
}

export default function PropertyTable({ properties, onDelete }) {
  return (
    <div className="property-table">
      <div className="property-table__scroll">
        <table>
          <caption className="sr-only">Property records in the local demonstration dashboard</caption>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Property</th>
              <th scope="col">Price</th>
              <th scope="col">Type / purpose</th>
              <th scope="col">Status</th>
              <th scope="col">Flags</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id}>
                <td>
                  <span className="table-reference">{property.id}</span>
                </td>
                <td>
                  <div className="table-property">
                    <span className="table-property__title">{property.title}</span>
                    <span className="table-property__location">
                      {property.location?.area}, {property.location?.city}
                    </span>
                    <span className="table-property__slug">/{property.slug}</span>
                  </div>
                </td>
                <td>
                  <span className="table-price">{formatPropertyPrice(property)}</span>
                </td>
                <td>
                  <div className="table-type">
                    <span>{propertyTypeLabels[property.type] || property.type}</span>
                    <span>{purposeLabels[property.purpose] || property.purpose}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge status={property.status} />
                </td>
                <td>
                  <Flags property={property} />
                </td>
                <td>
                  <RowActions property={property} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="property-cards" aria-label="Property records">
        {properties.map((property) => (
          <li className="property-admin-card" key={property.id}>
            <div className="property-admin-card__top">
              <span className="table-reference">{property.id}</span>
              <StatusBadge status={property.status} />
            </div>
            <h3 className="property-admin-card__title">{property.title}</h3>
            <p className="property-admin-card__location">
              {property.location?.area}, {property.location?.city}
            </p>
            <p className="property-admin-card__price">{formatPropertyPrice(property)}</p>
            <div className="property-admin-card__meta">
              <span>{propertyTypeLabels[property.type] || property.type}</span>
              <span>{purposeLabels[property.purpose] || property.purpose}</span>
              <Flags property={property} />
            </div>
            <RowActions property={property} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </div>
  );
}
