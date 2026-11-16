import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ToastContext from '../context/ToastContext';
import DocumentUploadModal from '../components/admin/inventory/DocumentUploadModal';

function renderModal() {
  return render(
    <ToastContext.Provider value={{ addToast: vi.fn() }}>
      <DocumentUploadModal projectId="project-1" onClose={() => {}} onSaved={() => {}} />
    </ToastContext.Provider>,
  );
}

describe('DocumentUploadModal', () => {
  it('clears the validation alert once a file is selected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /upload document/i }));
    expect(screen.getByText('Please correct the highlighted fields.')).toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'permit.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/^file/i), file);

    expect(screen.getByText('Selected: permit.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Please correct the highlighted fields.')).not.toBeInTheDocument();
  });
});
