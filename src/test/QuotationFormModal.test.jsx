import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ToastContext from '../context/ToastContext';
import salesApiService from '../services/salesApiService';
import QuotationFormModal from '../components/admin/sales/QuotationFormModal';

vi.mock('../services/salesApiService', () => ({
  default: { updateQuotation: vi.fn() },
}));

const quotation = {
  id: 'quotation-1',
  number: 'QT-2026-00001',
  customer_id: 'customer-1',
  lead_id: null,
  unit_id: 'unit-1',
  salesperson_id: null,
  quotation_date: '2026-11-01',
  valid_until: null,
  unit_price: 300000,
  discount_amount: 10000,
  tax_amount: 15000,
  terms: 'Booking within 14 days.',
  status: 'draft',
};

const units = [
  {
    id: 'unit-1',
    unit_number: 'A-101',
    sale_price: 300000,
    project: { id: 'project-1', name: 'Harbour Heights' },
  },
];

function renderModal() {
  return render(
    <ToastContext.Provider value={{ addToast: vi.fn() }}>
      <QuotationFormModal
        quotation={quotation}
        customers={[{ id: 'customer-1', name: 'Avery Stone' }]}
        units={units}
        onClose={() => {}}
      />
    </ToastContext.Provider>,
  );
}

describe('QuotationFormModal', () => {
  beforeEach(() => {
    salesApiService.updateQuotation.mockReset();
    salesApiService.updateQuotation.mockResolvedValue(quotation);
  });

  it('does not send the status when editing a quotation', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /save quotation/i }));

    await waitFor(() => expect(salesApiService.updateQuotation).toHaveBeenCalledTimes(1));
    const payload = salesApiService.updateQuotation.mock.calls[0][1];
    expect(payload).not.toHaveProperty('status');
    expect(payload).toMatchObject({ unit_price: 300000, customer_id: 'customer-1' });
  });
});
