import { z } from 'zod';
import { validationError } from './errors.js';

const emptyToNull = (value) => (value === '' || value === undefined ? null : value);

export const nullableString = (max = 255) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

export const nullableEmail = () =>
  z.preprocess(emptyToNull, z.string().trim().email('Enter a valid email address.').max(255).nullable());

export const nullableUuid = () =>
  z.preprocess(emptyToNull, z.string().uuid('Select a valid record.').nullable());

export const nullableDate = () =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date.')
      .nullable(),
  );

export const nullableDateTime = () =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.')
      .nullable(),
  );

export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0']), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 'true' || value === '1' || value === 1);

export const optionalBooleanish = booleanish.optional();

export const money = z.coerce.number().finite().min(0);
export const positiveMoney = z.coerce.number().finite().positive();
export const integer = z.coerce.number().int();

export function parseBody(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;

  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw validationError(fields);
}

export function parseQuery(schema, query) {
  const result = schema.safeParse(query ?? {});
  if (result.success) return result.data;

  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw validationError(fields);
}
