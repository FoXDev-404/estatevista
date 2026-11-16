import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import {
  labelFor,
  projectStatusOptions,
  projectTypeOptions,
  statusTone,
} from '../../../services/inventorySelectors';

export default function ProjectCard({ project, canEdit = false, canDelete = false, onDelete }) {
  const place = [project.city, project.location].filter(Boolean).join(', ');

  return (
    <article className="admin-project-card">
      <div className="admin-project-card__top">
        <span className="admin-project-card__reference">
          {project.code || project.number} · {labelFor(projectTypeOptions, project.type)}
        </span>
        <span className={`admin-badge admin-badge--${statusTone(project.status)}`}>
          {labelFor(projectStatusOptions, project.status)}
        </span>
      </div>

      <div className="admin-project-card__heading">
        <h2>
          <Link to={`/admin/projects/${project.id}`}>{project.name}</Link>
        </h2>
        <p className="admin-project-card__location">
          <MapPin size={15} aria-hidden="true" />
          {place || 'Location not set'}
        </p>
      </div>

      <dl className="admin-project-card__stats">
        <div>
          <dt>Buildings</dt>
          <dd>{project.buildings_count || 0}</dd>
        </div>
        <div>
          <dt>Units</dt>
          <dd>{project.units_count || 0}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{project.available_units || 0}</dd>
        </div>
        <div>
          <dt>Sold</dt>
          <dd>{project.sold_units || 0}</dd>
        </div>
      </dl>

      <div className="admin-project-card__actions">
        <Link className="table-action" to={`/admin/projects/${project.id}`}>
          <Building2 size={15} aria-hidden="true" />
          <span>Open</span>
          <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
        {canEdit ? (
          <Link className="table-action" to={`/admin/projects/${project.id}/edit`}>
            <Pencil size={15} aria-hidden="true" />
            <span>Edit</span>
          </Link>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className="table-action table-action--danger"
            onClick={() => onDelete(project)}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>Delete</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
