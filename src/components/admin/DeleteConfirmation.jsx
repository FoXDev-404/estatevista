import { AlertTriangle, LoaderCircle, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';

export default function DeleteConfirmation({ open, property, onCancel, onConfirm, isDeleting }) {
  return (
    <Modal
      open={open}
      onClose={isDeleting ? () => {} : onCancel}
      title="Delete this property?"
      description="This removes the record from local browser storage and every public section that uses it."
      footer={
        <>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger button--md"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <LoaderCircle className="spin" size={16} aria-hidden="true" />
            ) : (
              <Trash2 size={16} aria-hidden="true" />
            )}
            {isDeleting ? 'Deleting…' : 'Delete property'}
          </button>
        </>
      }
    >
      <div className="delete-confirmation">
        <span className="delete-confirmation__icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <div>
          <p>
            You are about to permanently delete{' '}
            <strong>{property?.title || 'this property'}</strong>
            {property?.id ? ` (${property.id})` : ''}.
          </p>
          <p>
            This action cannot be undone. Other records and saved changes are not affected.
          </p>
        </div>
      </div>
    </Modal>
  );
}
