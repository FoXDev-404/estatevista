import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';

const BUCKET_NAME = 'property-images';
const MAX_BYTES = 10 * 1024 * 1024;

export function createUploadRouter({ auth } = {}) {
  const router = Router();
  const manage = auth
    ? [auth.requireAuth, auth.requirePermission('properties.manage'), auth.requireCsrf]
    : [];

  router.post(
    '/',
    ...manage,
    asyncHandler(async (req, res) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new ApiError(503, 'Supabase storage is not configured.');
      }

      const { filename, data } = req.body || {};
      const fields = {};
      if (!filename) fields.filename = 'Choose a file to upload.';
      if (!data) fields.data = 'The file data is missing.';
      if (Object.keys(fields).length) throw validationError(fields);

      const matches = String(data).match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
      if (!matches) {
        throw validationError({
          data: 'Invalid image format. Upload a base64 data URL.',
        });
      }

      const [, contentType, base64Data] = matches;
      if (!contentType.startsWith('image/')) {
        throw validationError({ data: 'Only image files can be uploaded.' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > MAX_BYTES) {
        throw validationError({ data: 'Images must be 10MB or smaller.' });
      }

      const extension = String(filename).split('.').pop()?.toLowerCase() || 'jpg';
      const cleanBase = String(filename)
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 60);
      const storageFilename = `upload-${Date.now()}-${cleanBase || 'image'}.${extension}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storageFilename, buffer, { contentType, upsert: true });

      if (error) throw new ApiError(500, error.message);

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storageFilename);

      return res.status(201).json({
        success: true,
        url: publicUrlData.publicUrl,
        filename: storageFilename,
      });
    }),
  );

  return router;
}

export default createUploadRouter;
