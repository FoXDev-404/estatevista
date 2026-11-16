import { History, Pencil, Trash2 } from 'lucide-react';
import { formatNumber, formatPrice } from '../../../services/formatters';
import {
  labelFor,
  statusTone,
  unitStatusOptions,
} from '../../../services/inventorySelectors';

function priceLabel(unit) {
  const currency = unit.project?.currency || 'USD';
  if (Number(unit.sale_price) > 0) return formatPrice(unit.sale_price, currency);
  if (Number(unit.rent_price) > 0) return `${formatPrice(unit.rent_price, currency)} / mo`;
  return '—';
}

function locationLabel(unit) {
  const parts = [];
  if (unit.building?.code) parts.push(unit.building.code);
  if (unit.floor) parts.push(`Floor ${unit.floor.number}`);
  return parts.join(' · ') || '—';
}

export default function UnitTable({
  units = [],
  showProject = false,
  canEdit = false,
  canDelete = false,
  onEdit,
  onStatus,
  onDelete,
}) {
  const hasActions = canEdit || canDelete;

  return (
    <div className="admin-table__scroll">
      <table className="admin-table admin-unit-table">
        <thead>
          <tr>
            <th scope="col">Unit</th>
            {showProject ? <th scope="col">Project</th> : null}
            <th scope="col">Building / floor</th>
            <th scope="col">Type</th>
            <th scope="col">Area</th>
            <th scope="col">Price</th>
            <th scope="col">Status</th>
            {hasActions ? (
              <th scope="col" className="admin-table__actions-head">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const locked = ['reserved', 'sold', 'rented'].includes(unit.status);
            return (
              <tr key={unit.id}>
                <th scope="row">
                  <span className="admin-table__title">{unit.unit_number}</span>
                  {unit.description ? (
                    <span className="admin-table__muted admin-table__description">
                      {unit.description}
                    </span>
                  ) : null}
                </th>
                {showProject ? (
                  <td>
                    <span className="admin-table__stack">
                      <span>{unit.project?.name || '—'}</span>
                      <span className="admin-table__muted">{unit.project?.code || ''}</span>
                    </span>
                  </td>
                ) : null}
                <td>{locationLabel(unit)}</td>
                <td>{unit.unit_type?.name || <span className="admin-table__muted">Not set</span>}</td>
                <td>{unit.area ? `${formatNumber(unit.area)} ${unit.area_unit}` : '—'}</td>
                <td>{priceLabel(unit)}</td>
                <td>
                  <span className={`admin-badge admin-badge--${statusTone(unit.status)}`}>
                    {labelFor(unitStatusOptions, unit.status)}
                  </span>
                </td>
                {hasActions ? (
                  <td>
                    <div className="table-actions">
                      {canEdit ? (
                        <>
                          <button type="button" className="table-action" onClick={() => onEdit(unit)}>
                            <Pencil size={15} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button type="button" className="table-action" onClick={() => onStatus(unit)}>
                            <History size={15} aria-hidden="true" />
                            <span>Status</span>
                          </button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="table-action table-action--danger"
                          onClick={() => onDelete(unit)}
                          disabled={locked}
                          title={
                            locked
                              ? 'Close the active reservation, sale or lease before deleting this unit.'
                              : undefined
                          }
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
