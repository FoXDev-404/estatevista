import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../lib/errors.js';
import { parseBody, nullableEmail, nullableString } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import {
  DATE_FORMATS,
  NUMBER_DECIMAL_OPTIONS,
  RESET_PERIODS,
  sequenceLabel,
} from '../admin/catalog.js';

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

function isValidCurrency(code) {
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
}

function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter the company name.').max(200),
  legal_name: nullableString(200),
  registration_number: nullableString(100),
  tax_number: nullableString(100),
  email: nullableEmail(),
  phone: nullableString(50),
  address: nullableString(500),
  city: nullableString(100),
  state: nullableString(100),
  postal_code: nullableString(30),
  country: nullableString(100),
});

const localizationSchema = z.object({
  currency: z
    .string()
    .trim()
    .regex(CURRENCY_PATTERN, 'Choose a three-letter currency code.')
    .transform((value) => value.toUpperCase())
    .refine(isValidCurrency, 'Choose a valid currency.'),
  timezone: z
    .string()
    .trim()
    .min(1, 'Choose a timezone.')
    .max(100)
    .refine(isValidTimeZone, 'Choose a valid timezone.'),
  date_format: z.enum(DATE_FORMATS.map((format) => format.value)),
  number_decimals: z.coerce.number().int().min(0).max(3),
});

const numberingSchema = z.object({
  sequences: z
    .array(
      z.object({
        id: z.string().uuid('Choose a valid number sequence.'),
        prefix: z.string().trim().min(1, 'Enter a prefix.').max(20),
        padding: z.coerce.number().int().min(1).max(10),
        reset_period: z.enum(['never', 'yearly', 'monthly']),
      }),
    )
    .min(1),
});

const PROFILE_FIELDS = [
  'name',
  'legal_name',
  'registration_number',
  'tax_number',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'postal_code',
  'country',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

function settingsPayload(settings) {
  if (!settings) return null;
  const { payment_gateways: _gateways, smtp: _smtp, ...safe } = settings;
  return safe;
}

function sequencePayload(sequence) {
  return {
    id: sequence.id,
    document_type: sequence.document_type,
    label: sequenceLabel(sequence.document_type),
    prefix: sequence.prefix,
    padding: sequence.padding,
    reset_period: sequence.reset_period,
    next_value: sequence.next_value,
    updated_at: sequence.updated_at,
  };
}

export function createSettingsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('settings.view')];
  const edit = [auth.requireAuth, auth.requirePermission('settings.edit'), auth.requireCsrf];

  const writeChange = (req, module, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module,
      recordId,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const [company, settings, sequences] = await Promise.all([
        repository.getCompany(companyId),
        repository.getSettings(companyId),
        repository.listSequences(companyId),
      ]);

      res.json({
        data: {
          company,
          settings: settingsPayload(settings),
          sequences: sequences.map(sequencePayload),
        },
        meta: {
          date_formats: DATE_FORMATS,
          number_decimals: NUMBER_DECIMAL_OPTIONS,
          reset_periods: RESET_PERIODS,
        },
      });
    }),
  );

  router.patch(
    '/profile',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(profileSchema, req.body);
      const before = await repository.getCompany(companyId);
      const company = await repository.updateCompany(companyId, input);

      await writeChange(req, 'Company', companyId, 'updated', pick(before, PROFILE_FIELDS), pick(company, PROFILE_FIELDS));
      res.json({ data: company });
    }),
  );

  router.patch(
    '/localization',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(localizationSchema, req.body);
      const before = await repository.getCompany(companyId);
      const company = await repository.updateCompany(companyId, input);

      const fields = ['currency', 'timezone', 'date_format', 'number_decimals'];
      await writeChange(req, 'Company', companyId, 'updated', pick(before, fields), pick(company, fields));
      res.json({ data: company });
    }),
  );

  router.patch(
    '/numbering',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(numberingSchema, req.body);
      const current = await repository.listSequences(companyId);
      const currentById = new Map(current.map((sequence) => [sequence.id, sequence]));

      const unknown = input.sequences.find((sequence) => !currentById.has(sequence.id));
      if (unknown) {
        throw new ApiError(404, 'Number sequence not found.');
      }

      const updated = [];
      for (const sequence of input.sequences) {
        const before = currentById.get(sequence.id);
        const after = await repository.updateSequence(companyId, sequence.id, {
          prefix: sequence.prefix,
          padding: sequence.padding,
          reset_period: sequence.reset_period,
        });

        const changed =
          before.prefix !== after.prefix ||
          before.padding !== after.padding ||
          before.reset_period !== after.reset_period;

        if (changed) {
          await writeChange(
            req,
            'NumberSequence',
            sequence.id,
            'updated',
            {
              document_type: before.document_type,
              prefix: before.prefix,
              padding: before.padding,
              reset_period: before.reset_period,
            },
            {
              document_type: after.document_type,
              prefix: after.prefix,
              padding: after.padding,
              reset_period: after.reset_period,
            },
          );
        }
        updated.push(sequencePayload(after));
      }

      res.json({ data: updated });
    }),
  );

  return router;
}

export default createSettingsRouter;
