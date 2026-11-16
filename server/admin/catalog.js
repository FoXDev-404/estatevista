// Shared reference data for company settings. Keeping the order here means the
// numbering screen is stable regardless of the order rows were inserted.

export const SEQUENCE_DEFINITIONS = [
  { document_type: 'contractor', label: 'Contractor', prefix: 'CTR-', padding: 4, reset_period: 'never' },
  { document_type: 'contractor_bill', label: 'Contractor bill', prefix: 'BILL-', padding: 5, reset_period: 'yearly' },
  { document_type: 'contractor_contract', label: 'Contractor contract', prefix: 'CON-', padding: 4, reset_period: 'never' },
  { document_type: 'customer', label: 'Customer', prefix: 'CUS-', padding: 5, reset_period: 'never' },
  { document_type: 'employee', label: 'Employee', prefix: 'EMP-', padding: 4, reset_period: 'never' },
  { document_type: 'employee_advance', label: 'Employee advance', prefix: 'ADV-', padding: 4, reset_period: 'yearly' },
  { document_type: 'expense', label: 'Expense', prefix: 'EXP-', padding: 5, reset_period: 'yearly' },
  { document_type: 'income', label: 'Income', prefix: 'INC-', padding: 5, reset_period: 'yearly' },
  { document_type: 'journal_entry', label: 'Journal entry', prefix: 'JE-', padding: 6, reset_period: 'yearly' },
  { document_type: 'laborer', label: 'Laborer', prefix: 'LAB-', padding: 4, reset_period: 'never' },
  { document_type: 'lease', label: 'Lease', prefix: 'LSE-', padding: 5, reset_period: 'yearly' },
  { document_type: 'loan', label: 'Loan', prefix: 'LN-', padding: 4, reset_period: 'never' },
  { document_type: 'loan_payment', label: 'Loan payment', prefix: 'LNP-', padding: 5, reset_period: 'yearly' },
  { document_type: 'maintenance_request', label: 'Maintenance request', prefix: 'MNT-', padding: 5, reset_period: 'yearly' },
  { document_type: 'material', label: 'Material (SKU)', prefix: 'MAT-', padding: 4, reset_period: 'never' },
  { document_type: 'material_issue', label: 'Material issue', prefix: 'MI-', padding: 5, reset_period: 'yearly' },
  { document_type: 'payment_receipt', label: 'Payment receipt', prefix: 'RCP-', padding: 6, reset_period: 'yearly' },
  { document_type: 'payout', label: 'Payout', prefix: 'PAY-', padding: 5, reset_period: 'yearly' },
  { document_type: 'payroll_run', label: 'Payroll run', prefix: 'PR-', padding: 3, reset_period: 'yearly' },
  { document_type: 'project', label: 'Project', prefix: 'PRJ-', padding: 4, reset_period: 'never' },
  { document_type: 'purchase', label: 'Purchase', prefix: 'PUR-', padding: 5, reset_period: 'yearly' },
  { document_type: 'purchase_order', label: 'Purchase order', prefix: 'PO-', padding: 5, reset_period: 'yearly' },
  { document_type: 'purchase_return', label: 'Purchase return', prefix: 'PRN-', padding: 5, reset_period: 'yearly' },
  { document_type: 'quotation', label: 'Quotation', prefix: 'QT-', padding: 5, reset_period: 'yearly' },
  { document_type: 'refund', label: 'Refund', prefix: 'RFD-', padding: 5, reset_period: 'yearly' },
  { document_type: 'reservation', label: 'Reservation', prefix: 'RSV-', padding: 5, reset_period: 'yearly' },
  { document_type: 'sale', label: 'Sale', prefix: 'SAL-', padding: 5, reset_period: 'yearly' },
  { document_type: 'supplier', label: 'Supplier', prefix: 'SUP-', padding: 4, reset_period: 'never' },
  { document_type: 'tenant', label: 'Tenant', prefix: 'TEN-', padding: 5, reset_period: 'never' },
  { document_type: 'transfer', label: 'Transfer', prefix: 'TRF-', padding: 5, reset_period: 'yearly' },
];

export const SEQUENCE_LABELS = Object.fromEntries(
  SEQUENCE_DEFINITIONS.map((sequence) => [sequence.document_type, sequence.label]),
);

export const SEQUENCE_ORDER = Object.fromEntries(
  SEQUENCE_DEFINITIONS.map((sequence, index) => [sequence.document_type, index]),
);

export const RESET_PERIODS = [
  { value: 'never', label: 'Never' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
];

export const DATE_FORMATS = [
  { value: 'YYYY-MM-DD', label: '2026-11-16' },
  { value: 'DD/MM/YYYY', label: '16/11/2026' },
  { value: 'MM/DD/YYYY', label: '11/16/2026' },
  { value: 'DD-MM-YYYY', label: '16-11-2026' },
  { value: 'MM-DD-YYYY', label: '11-16-2026' },
  { value: 'DD.MM.YYYY', label: '16.11.2026' },
  { value: 'YYYY/MM/DD', label: '2026/11/16' },
  { value: 'D MMM YYYY', label: '16 Nov 2026' },
  { value: 'MMM D, YYYY', label: 'Nov 16, 2026' },
  { value: 'D MMMM YYYY', label: '16 November 2026' },
  { value: 'MMMM D, YYYY', label: 'November 16, 2026' },
  { value: 'YYYYMMDD', label: '20261116' },
];

export const NUMBER_DECIMAL_OPTIONS = [
  { value: 0, label: '0 — 1,235' },
  { value: 2, label: '2 — 1,234.57' },
  { value: 3, label: '3 — 1,234.568' },
];

export function sequenceLabel(documentType) {
  return SEQUENCE_LABELS[documentType] || documentType.replaceAll('_', ' ');
}

export function sortSequences(rows) {
  return [...rows].sort(
    (a, b) =>
      (SEQUENCE_ORDER[a.document_type] ?? Number.MAX_SAFE_INTEGER) -
      (SEQUENCE_ORDER[b.document_type] ?? Number.MAX_SAFE_INTEGER),
  );
}

export function formatSequencePreview(sequence, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const next = String(sequence.next_value ?? 1).padStart(sequence.padding ?? 4, '0');
  if (sequence.reset_period === 'yearly') return `${sequence.prefix}${year}-${next}`;
  if (sequence.reset_period === 'monthly') return `${sequence.prefix}${year}${month}-${next}`;
  return `${sequence.prefix}${next}`;
}
