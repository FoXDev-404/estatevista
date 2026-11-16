import { describe, expect, it } from 'vitest';
import {
  budgetLabel,
  customerTypeOptions,
  followupTypeOptions,
  fromDateTimeInput,
  labelFor,
  leadInterestLabel,
  leadStageFlow,
  leadStageOptions,
  leadStageTone,
  toDateTimeInput,
  visitActions,
  visitStatusOptions,
  visitStatusTone,
} from '../services/crmSelectors';
import { formatPrice } from '../services/formatters';

describe('crm selectors', () => {
  it('exposes the lead, customer, visit and follow-up catalogues in demo order', () => {
    expect(leadStageOptions.map((option) => option.value)).toEqual([
      'new',
      'contacted',
      'qualified',
      'visit_scheduled',
      'negotiation',
      'won',
      'lost',
    ]);
    expect(leadStageFlow.map((option) => option.value)).toEqual([
      'new',
      'contacted',
      'qualified',
      'visit_scheduled',
      'negotiation',
      'won',
    ]);
    expect(customerTypeOptions.map((option) => option.value)).toEqual(['individual', 'company']);
    expect(visitStatusOptions.map((option) => option.value)).toEqual([
      'scheduled',
      'completed',
      'cancelled',
      'no_show',
    ]);
    expect(followupTypeOptions.map((option) => option.value)).toContain('site_visit');
  });

  it('maps stages and visit statuses to admin badge tones', () => {
    expect(leadStageTone('won')).toBe('success');
    expect(leadStageTone('lost')).toBe('danger');
    expect(leadStageTone('negotiation')).toBe('gold');
    expect(leadStageTone('new')).toBe('muted');
    expect(visitStatusTone('completed')).toBe('success');
    expect(visitStatusTone('cancelled')).toBe('danger');
    expect(visitStatusTone('no_show')).toBe('danger');
    expect(visitStatusTone('scheduled')).toBe('active');
  });

  it('formats budgets and interest labels', () => {
    expect(budgetLabel({ budget_min: 100000, budget_max: 250000 })).toBe(
      `${formatPrice(100000, 'USD')} – ${formatPrice(250000, 'USD')}`,
    );
    expect(budgetLabel({ budget_min: 100000, budget_max: null })).toMatch(/^From /);
    expect(budgetLabel({ budget_min: null, budget_max: 250000 })).toMatch(/^Up to /);
    expect(budgetLabel({})).toBe('—');

    expect(
      leadInterestLabel({
        project: { name: 'Lakeview Heights' },
        unit: { unit_number: 'A-101' },
      }),
    ).toBe('Lakeview Heights · A-101');
    expect(leadInterestLabel({})).toBe('—');
  });

  it('offers visit lifecycle actions that match the server transitions', () => {
    expect(visitActions('scheduled').map((action) => action.status)).toEqual([
      'completed',
      'cancelled',
      'no_show',
    ]);
    expect(visitActions('completed')).toEqual([{ status: 'scheduled', label: 'Reopen' }]);
    expect(visitActions('cancelled')).toEqual([{ status: 'scheduled', label: 'Reopen' }]);
  });

  it('converts between ISO timestamps and datetime-local values', () => {
    const iso = '2030-02-05T15:30:00.000Z';
    expect(fromDateTimeInput(toDateTimeInput(iso))).toBe(iso);
    expect(fromDateTimeInput('')).toBeNull();
    expect(toDateTimeInput('')).toBe('');
    expect(toDateTimeInput('not-a-date')).toBe('');
    expect(labelFor(visitStatusOptions, 'no_show')).toBe('No-show');
  });
});
