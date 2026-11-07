import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { toDbRow, fromDbRow } from '../models/propertyMapper.js';
import { seedProperties } from '../../src/data/properties.js';

const router = Router();

// Generate next property ID if none provided
async function generateNextId() {
  if (!supabase) return 'PROP-001';

  const { data } = await supabase
    .from('properties')
    .select('id');

  const properties = data || [];
  const highest = properties.reduce((max, prop) => {
    const match = /^PROP-(\d+)$/.exec(prop.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `PROP-${String(highest + 1).padStart(3, '0')}`;
}

// GET /api/properties - Retrieve all or filtered properties
router.get('/', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured',
      fallback: true,
    });
  }

  try {
    const { type, purpose, city, featured, search, sort } = req.query;

    let query = supabase.from('properties').select('*');

    if (type && type !== 'all') {
      query = query.eq('type', type.toLowerCase());
    }
    if (purpose && purpose !== 'all') {
      query = query.eq('purpose', purpose.toLowerCase());
    }
    if (city && city !== 'all') {
      query = query.filter('location->>city', 'ilike', city);
    }
    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    // Sorting
    if (sort === 'price-asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price-desc') {
      query = query.order('price', { ascending: false });
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sort === 'alphabetical') {
      query = query.order('title', { ascending: true });
    } else {
      // Default: newest or id
      query = query.order('id', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching properties from Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    let results = (data || []).map(fromDbRow);

    // Keyword search filter (if passed in query)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.location?.city?.toLowerCase().includes(q) ||
        p.location?.area?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.amenities?.some((a) => a.toLowerCase().includes(q))
      );
    }

    res.json(results);
  } catch (err) {
    console.error('Unexpected error in GET /api/properties:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/properties/:idOrSlug - Retrieve single property by ID or slug
router.get('/:idOrSlug', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    const { idOrSlug } = req.params;
    const isId = /^PROP-\d+$/i.test(idOrSlug.trim());

    const query = supabase.from('properties').select('*');
    const { data, error } = isId
      ? await query.eq('id', idOrSlug.trim().toUpperCase()).maybeSingle()
      : await query.eq('slug', idOrSlug.trim().toLowerCase()).maybeSingle();

    if (error) {
      console.error('Error fetching property:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: `Property "${idOrSlug}" not found` });
    }

    res.json(fromDbRow(data));
  } catch (err) {
    console.error('Unexpected error in GET /api/properties/:idOrSlug:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties - Create new property
router.post('/', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    const body = req.body || {};
    if (!body.title || !body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const id = body.id || (await generateNextId());
    const row = toDbRow({ ...body, id });

    const { data, error } = await supabase
      .from('properties')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Error inserting property into Supabase:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(fromDbRow(data));
  } catch (err) {
    console.error('Unexpected error in POST /api/properties:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/properties/:id - Update existing property
router.put('/:id', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    const id = req.params.id.trim().toUpperCase();
    const body = req.body || {};
    const row = toDbRow({ ...body, id });

    const { data, error } = await supabase
      .from('properties')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property in Supabase:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: `Property "${id}" not found` });
    }

    res.json(fromDbRow(data));
  } catch (err) {
    console.error('Unexpected error in PUT /api/properties/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/properties/:id - Delete a property
router.delete('/:id', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    const id = req.params.id.trim().toUpperCase();

    // Check if property exists first
    const { data: existing } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: `Property "${id}" not found` });
    }

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting property in Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(fromDbRow(existing));
  } catch (err) {
    console.error('Unexpected error in DELETE /api/properties/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/properties/reset - Reset to seed properties
router.post('/reset', async (req, res) => {
  if (!isSupabaseConfigured || !supabase) {
    return res.status(503).json({ error: 'Supabase is not configured' });
  }

  try {
    console.log('Resetting Supabase properties table to original seed records...');

    // Delete existing properties
    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .neq('id', 'NONE');

    if (deleteError) {
      console.error('Error clearing properties table:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    // Insert canonical seed properties
    const dbRows = seedProperties.map(toDbRow);
    const { data, error: insertError } = await supabase
      .from('properties')
      .insert(dbRows)
      .select();

    if (insertError) {
      console.error('Error re-inserting seed properties:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    const results = (data || []).map(fromDbRow);
    res.json(results);
  } catch (err) {
    console.error('Unexpected error in POST /api/properties/reset:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

