import { SearchX } from 'lucide-react';

export default function EmptyState({
  icon: Icon = SearchX,
  title = 'Nothing here yet',
  description,
  action,
  className = '',
}) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ''}`} role="status">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon size={26} strokeWidth={1.5} />
      </span>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
