import { useState } from 'react';
import { AlertCircle, FileUp, LoaderCircle } from 'lucide-react';
import Modal from '../../common/Modal';
import FormField from '../../common/FormField';
import useToast from '../../../hooks/useToast';
import { ApiError } from '../../../services/apiClient';
import inventoryApiService from '../../../services/inventoryApiService';
import { fileToDataUrl } from '../../../services/inventorySelectors';

const MAX_BYTES = 10 * 1024 * 1024;
const CATEGORIES = ['Permit', 'Layout plan', 'Brochure', 'Contract', 'Other'];

export default function DocumentUploadModal({ projectId, onClose, onSaved }) {
  const { addToast } = useToast();
  const [category, setCategory] = useState('Permit');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setErrors({ file_name: 'Choose a file to upload.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors({ file_name: 'Use a file smaller than 10 MB.' });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const data = await fileToDataUrl(file);
      const document = await inventoryApiService.uploadDocument({
        owner_type: 'project',
        owner_id: projectId,
        category,
        file_name: file.name,
        data,
      });
      addToast(`"${document.file_name}" was uploaded.`, 'success');
      onSaved?.(document);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields || {});
      addToast(error.message || 'The file could not be uploaded.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={close}
      title="Upload document"
      description="Files are stored privately with the project and can be removed by an administrator."
      footer={
        <>
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="document-upload-form"
            className="button button--primary button--md"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            ) : (
              <FileUp size={16} aria-hidden="true" />
            )}
            {saving ? 'Uploading…' : 'Upload document'}
          </button>
        </>
      }
    >
      <form
        id="document-upload-form"
        className="admin-modal-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="admin-form-grid admin-form-grid--two">
          <FormField
            label="Category"
            id="document-category"
            as="select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            error={errors.category}
          >
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </FormField>

          <FormField
            label="File"
            id="document-file"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setErrors((current) => ({ ...current, file_name: undefined, data: undefined }));
            }}
            error={errors.file_name || errors.data}
            hint="PDF, Office, image or text file up to 10 MB."
            required
          />

          <p className="admin-modal-note admin-form-grid__full">
            {file ? `Selected: ${file.name}` : 'No file selected yet.'}
          </p>
        </div>

        {Object.values(errors).some(Boolean) ? (
          <div className="admin-alert admin-alert--danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>Please correct the highlighted fields.</p>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
