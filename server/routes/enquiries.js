import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEnquiriesRouter({ auth } = {}) {
  const router = Router();
  const view = auth ? [auth.requireAuth, auth.requirePermission('enquiries.view')] : [];

  // GET /api/enquiries — authenticated inbox for legacy website enquiries.
  router.get(
    '/',
    ...view,
    asyncHandler(async (_req, res) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new ApiError(503, 'Supabase is not configured.');
      }

      const { data, error } = await supabase
        .from('enquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(500, error.message);
      return res.json(data || []);
    }),
  );

  // POST /api/enquiries — public contact form.
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      if (!isSupabaseConfigured || !supabase) {
        return res.status(503).json({
          error: 'Supabase is not configured',
          fallback: true,
        });
      }

      const { name, email, phone, subject, message, propertyId, type } = req.body || {};
      const fields = {};

      if (!name || !String(name).trim()) fields.name = 'Enter your name.';
      if (!email || !String(email).trim()) fields.email = 'Enter your email address.';
      else if (!EMAIL_PATTERN.test(String(email).trim())) {
        fields.email = 'Enter a valid email address.';
      }
      if (!message || !String(message).trim()) fields.message = 'Enter a message.';

      if (Object.keys(fields).length) {
        throw validationError(fields, 'Please correct the highlighted fields.');
      }

      const newEnquiry = {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: String(phone || '').trim(),
        subject: subject ? String(subject).trim() : null,
        message: String(message).trim(),
        property_id: propertyId ? String(propertyId).trim().toUpperCase() : null,
        type: type || (propertyId ? 'property' : 'general'),
      };

      const { data, error } = await supabase
        .from('enquiries')
        .insert([newEnquiry])
        .select()
        .single();

      if (error) throw new ApiError(400, error.message);

      return res.status(201).json({
        success: true,
        message: 'Enquiry received and saved to database',
        enquiry: data,
      });
    }),
  );

  return router;
}

export default createEnquiriesRouter;
