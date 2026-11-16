import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { nullableEmail, nullableString, parseBody } from '../lib/validation.js';

describe('validation helpers', () => {
  it('maps zod issues to a field error object', () => {
    const schema = z.object({
      name: z.string().trim().min(1, 'Name is required.'),
      email: z.string().trim().email('Enter a valid email address.'),
    });

    expect(() => parseBody(schema, { name: '', email: 'nope' })).toThrowError(
      expect.objectContaining({
        status: 422,
        fields: {
          name: 'Name is required.',
          email: 'Enter a valid email address.',
        },
      }),
    );
  });

  it('returns the parsed data when valid', () => {
    const schema = z.object({ name: z.string().trim().min(1) });
    expect(parseBody(schema, { name: '  Acme  ' })).toEqual({ name: 'Acme' });
  });

  it('treats empty optional fields as null', () => {
    const schema = z.object({
      phone: nullableString(50),
      email: nullableEmail(),
    });

    expect(parseBody(schema, { phone: '', email: '' })).toEqual({ phone: null, email: null });
    expect(parseBody(schema, {})).toEqual({ phone: null, email: null });
  });
});
