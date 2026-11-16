import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { parseBody, nullableEmail, nullableString, nullableUuid } from '../lib/validation.js';
import { WEBSITE_INQUIRY_TYPES } from '../lib/inquiries.js';
import { resolveProjectUnit } from './crmSupport.js';

const emptyToText = (value) => (value === undefined || value === null ? '' : value);

const publicInquirySchema = z
  .object({
    type: z
      .enum(WEBSITE_INQUIRY_TYPES, { message: 'Choose an inquiry type.' })
      .default('general'),
    name: z.string().trim().min(1, 'Enter your name.').max(160),
    phone: nullableString(40),
    email: nullableEmail(),
    message: z.preprocess(
      emptyToText,
      z.string().trim().min(1, 'Enter a message.').max(2000),
    ),
    subject: nullableString(200),
    property_id: nullableString(32),
    project_id: nullableUuid(),
    unit_id: nullableUuid(),
    source_page: nullableString(500),
    locale: nullableString(10),
    submission_key: z
      .string()
      .trim()
      .min(8, 'Refresh the page and try again.')
      .max(120, 'Refresh the page and try again.'),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a phone number or an email address.',
      });
    }
  });

function storedMessage(subject, message) {
  const subjectText = String(subject || '').trim();
  return subjectText ? `Subject: ${subjectText}\n\n${message}` : message;
}

function leadNotes(inquiry, property) {
  const parts = [inquiry.message];
  if (property) parts.push(`Property: ${property.title} (${property.id})`);
  if (inquiry.source_page) parts.push(`Source: ${inquiry.source_page}`);
  return parts.join('\n\n').slice(0, 4000);
}

/**
 * Creates the Website lead that backs an inquiry. Safe to call twice: an
 * inquiry that already carries a lead is returned unchanged.
 */
async function attachLead(repository, companyId, inquiry) {
  if (inquiry.lead_id) return inquiry;

  const [source, property] = await Promise.all([
    repository.findSourceByName(companyId, 'Website'),
    inquiry.property_id ? repository.getPublicProperty(inquiry.property_id) : null,
  ]);

  const lead = await repository.createLead(companyId, {
    source_id: source?.id || null,
    assigned_to: null,
    project_id: inquiry.project_id || null,
    unit_id: inquiry.unit_id || null,
    name: inquiry.name,
    phone: inquiry.phone,
    email: inquiry.email,
    status: 'new',
    lost_reason: null,
    budget_min: null,
    budget_max: null,
    notes: leadNotes(inquiry, property),
    created_by: null,
    updated_by: null,
  });

  return repository.updateWebsiteInquiry(companyId, inquiry.id, { lead_id: lead.id });
}

async function finishCapture(repository, companyId, inquiry) {
  try {
    await attachLead(repository, companyId, inquiry);
  } catch {
    // The inquiry is captured; a retry with the same submission key heals the
    // missing lead without creating a second inquiry.
  }
}

export function createPublicInquiriesRouter({ repository, publicCompanySlug }) {
  const router = Router();

  // POST /api/public/inquiries — public contact, project, property and visit requests.
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const company = await repository.getCompanyBySlug(publicCompanySlug);
      if (!company) {
        throw new ApiError(503, 'The public inquiry form is not connected to a workspace.');
      }
      const companyId = company.id;
      const input = parseBody(publicInquirySchema, req.body);

      const existing = await repository.findWebsiteInquiryBySubmissionKey(
        companyId,
        input.submission_key,
      );
      if (existing) {
        await finishCapture(repository, companyId, existing);
        return res.status(200).json({ success: true, duplicate: true });
      }

      const resolved = await resolveProjectUnit(repository, companyId, input);
      const email = input.email ? input.email.toLowerCase() : null;
      let property = null;
      if (input.property_id) {
        property = await repository.getPublicProperty(input.property_id);
        if (!property) {
          throw validationError({ property_id: 'Choose a property from the website.' });
        }
      }

      let inquiry;
      try {
        inquiry = await repository.createWebsiteInquiry(companyId, {
          type: input.type,
          name: input.name,
          phone: input.phone,
          email,
          project_id: resolved.project_id || null,
          unit_id: input.unit_id,
          property_id: property?.id || null,
          message: storedMessage(input.subject, input.message),
          source_page: input.source_page,
          locale: input.locale || 'en',
          status: 'new',
          lead_id: null,
          submission_key: input.submission_key,
        });
      } catch (error) {
        if (error?.status !== 409) throw error;
        const duplicate = await repository.findWebsiteInquiryBySubmissionKey(
          companyId,
          input.submission_key,
        );
        if (!duplicate) throw new ApiError(409, 'This submission could not be accepted.');
        await finishCapture(repository, companyId, duplicate);
        return res.status(200).json({ success: true, duplicate: true });
      }

      await finishCapture(repository, companyId, inquiry);
      return res.status(201).json({ success: true, duplicate: false });
    }),
  );

  return router;
}

export default createPublicInquiriesRouter;
