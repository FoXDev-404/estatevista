import { describe, expect, it } from 'vitest';
import {
  inquiryInterestLabel,
  inquiryStatusOptions,
  inquiryStatusTone,
  inquiryTypeLabel,
  inquiryTypeOptions,
} from '../services/inquirySelectors';

describe('inquiry selectors', () => {
  it('exposes the website inquiry type and status catalogues in demo order', () => {
    expect(inquiryTypeOptions.map((option) => option.value)).toEqual([
      '',
      'general',
      'project',
      'property',
      'visit',
    ]);
    expect(inquiryStatusOptions.map((option) => option.value)).toEqual([
      '',
      'new',
      'converted',
      'closed',
    ]);
  });

  it('labels inquiry types and statuses', () => {
    expect(inquiryTypeLabel('general')).toBe('General inquiry');
    expect(inquiryTypeLabel('project')).toBe('Project inquiry');
    expect(inquiryTypeLabel('property')).toBe('Property inquiry');
    expect(inquiryTypeLabel('visit')).toBe('Site visit request');
    expect(inquiryTypeLabel('unknown')).toBe('unknown');
  });

  it('summarises what the inquiry is interested in', () => {
    expect(
      inquiryInterestLabel({
        project: { name: 'Lakeview Heights' },
        unit: { unit_number: 'A-101' },
      }),
    ).toBe('Lakeview Heights · A-101');
    expect(inquiryInterestLabel({ project: { name: 'Lakeview Heights' } })).toBe(
      'Lakeview Heights',
    );
    expect(inquiryInterestLabel({ property: { title: 'Marina Loft' } })).toBe('Marina Loft');
    expect(inquiryInterestLabel({ unit: { unit_number: 'A-101' } })).toBe('Unit A-101');
    expect(inquiryInterestLabel({})).toBe('General inquiry');
  });

  it('maps inquiry statuses to admin badge tones', () => {
    expect(inquiryStatusTone('new')).toBe('active');
    expect(inquiryStatusTone('converted')).toBe('success');
    expect(inquiryStatusTone('closed')).toBe('muted');
  });
});
