import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';

export default function Logo({ variant = 'dark', onClick, className = '' }) {
  return (
    <Link
      to="/"
      className={`logo logo--${variant}${className ? ` ${className}` : ''}`}
      aria-label="EstateVista home"
      onClick={onClick}
    >
      <span className="logo__mark" aria-hidden="true">
        <Landmark size={18} strokeWidth={1.5} />
      </span>
      <span className="logo__text">
        <span className="logo__name">EstateVista</span>
        <span className="logo__descriptor">Exceptional places to live</span>
      </span>
    </Link>
  );
}
