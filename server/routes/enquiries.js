import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';

const router = Router();

// GET /api/enquiries - Retrieve all enquiries (for admin inspection)
router.get('/', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching enquiries from Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Unexpected error in GET /api/enquiries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/enquiries - Submit contact or property enquiry
router.post('/', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured',
      fallback: true,
    });
  }

  try {
    const { name, email, phone, subject, message, propertyId, type } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Name, email, and message are required fields',
      });
    }

    const newEnquiry = {
      name: String(name).trim(),
      email: String(email).trim(),
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

    if (error) {
      console.error('Error creating enquiry in Supabase:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Enquiry received and saved to database',
      enquiry: data,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/enquiries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

