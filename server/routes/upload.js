import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

const router = Router();
const BUCKET_NAME = 'property-images';

// POST /api/upload - Upload an image to Supabase Storage
router.post('/', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase storage is not configured' });
  }

  try {
    const { filename, data } = req.body || {};

    if (!filename || !data) {
      return res.status(400).json({ error: 'Filename and image data are required.' });
    }

    // Parse base64 data URL
    const matches = data.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Limit to 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image exceeds the 10MB size limit.' });
    }

    // Generate unique safe file name
    const ext = filename.split('.').pop().toLowerCase();
    const cleanBase = filename.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const storageFilename = `upload-${Date.now()}-${cleanBase}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storageFilename, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storageFilename);

    res.status(201).json({
      success: true,
      url: publicUrlData.publicUrl,
      filename: storageFilename,
    });
  } catch (err) {
    console.error('Upload endpoint error:', err);
    res.status(500).json({ error: 'Failed to process image upload.' });
  }
});

export default router;
