import { statusLabels } from '../../data/propertyOptions';

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null;
  return (
    <span className={`status-badge status-badge--${status}${className ? ` ${className}` : ''}`}>
      {statusLabels[status] || status}
    </span>
  );
}
