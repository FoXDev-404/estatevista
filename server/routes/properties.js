import { Router } from 'express';
import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { toDbRow, fromDbRow } from '../models/propertyMapper.js';
import { seedProperties } from '../../src/data/properties.js';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';

function requireDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new ApiError(503, 'Supabase is not configured.');
  }
}

async function generateNextId() {
  if (!supabase) return 'PROP-001';

  const { data } = await supabase.from('properties').select('id');
  const properties = data || [];
  const highest = properties.reduce((max, property) => {
    const match = /^PROP-(\d+)$/.exec(property.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `PROP-${String(highest + 1).padStart(3, '0')}`;
}

export function createPropertiesRouter({ auth } = {}) {
  const router = Router();
  const manage = auth
    ? [auth.requireAuth, auth.requirePermission('properties.manage'), auth.requireCsrf]
    : [];

  // GET /api/properties — public marketplace listing.
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      if (!isSupabaseConfigured || !supabase) {
        return res.status(503).json({ error: 'Supabase is not configured', fallback: true });
      }

      const { type, purpose, city, featured, search, sort } = req.query;
      let query = supabase.from('properties').select('*');

      if (type && type !== 'all') query = query.eq('type', String(type).toLowerCase());
      if (purpose && purpose !== 'all') query = query.eq('purpose', String(purpose).toLowerCase());
      if (city && city !== 'all') query = query.filter('location->>city', 'ilike', city);
      if (featured === 'true') query = query.eq('featured', true);

      if (sort === 'price-asc') query = query.order('price', { ascending: true });
      else if (sort === 'price-desc') query = query.order('price', { ascending: false });
      else if (sort === 'oldest') query = query.order('created_at', { ascending: true });
      else if (sort === 'alphabetical') query = query.order('title', { ascending: true });
      else query = query.order('id', { ascending: true });

      const { data, error } = await query;
      if (error) throw new ApiError(500, error.message);

      let results = (data || []).map(fromDbRow);

      if (search && String(search).trim()) {
        const needle = String(search).trim().toLowerCase();
        results = results.filter(
          (property) =>
            property.title.toLowerCase().includes(needle) ||
            property.location?.city?.toLowerCase().includes(needle) ||
            property.location?.area?.toLowerCase().includes(needle) ||
            property.description?.toLowerCase().includes(needle) ||
            property.amenities?.some((amenity) => amenity.toLowerCase().includes(needle)),
        );
      }

      return res.json(results);
    }),
  );

  // GET /api/properties/:idOrSlug — public property detail.
  router.get(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      requireDatabase();

      const { idOrSlug } = req.params;
      const isId = /^PROP-\d+$/i.test(idOrSlug.trim());
      const query = supabase.from('properties').select('*');
      const { data, error } = isId
        ? await query.eq('id', idOrSlug.trim().toUpperCase()).maybeSingle()
        : await query.eq('slug', idOrSlug.trim().toLowerCase()).maybeSingle();

      if (error) throw new ApiError(500, error.message);
      if (!data) throw new ApiError(404, `Property "${idOrSlug}" not found.`);

      return res.json(fromDbRow(data));
    }),
  );

  router.post(
    '/',
    ...manage,
    asyncHandler(async (req, res) => {
      requireDatabase();

      const body = req.body || {};
      if (!body.title || !String(body.title).trim()) {
        throw validationError({ title: 'Title is required.' });
      }

      const id = body.id || (await generateNextId());
      const { data, error } = await supabase
        .from('properties')
        .insert([toDbRow({ ...body, id })])
        .select()
        .single();

      if (error) throw new ApiError(400, error.message);
      return res.status(201).json(fromDbRow(data));
    }),
  );

  router.put(
    '/:id',
    ...manage,
    asyncHandler(async (req, res) => {
      requireDatabase();

      const id = req.params.id.trim().toUpperCase();
      const { data, error } = await supabase
        .from('properties')
        .update(toDbRow({ ...(req.body || {}), id }))
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new ApiError(400, error.message);
      if (!data) throw new ApiError(404, `Property "${id}" not found.`);

      return res.json(fromDbRow(data));
    }),
  );

  router.delete(
    '/:id',
    ...manage,
    asyncHandler(async (req, res) => {
      requireDatabase();

      const id = req.params.id.trim().toUpperCase();
      const { data: existing, error: readError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (readError) throw new ApiError(500, readError.message);
      if (!existing) throw new ApiError(404, `Property "${id}" not found.`);

      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw new ApiError(500, error.message);

      return res.json(fromDbRow(existing));
    }),
  );

  router.post(
    '/reset',
    ...manage,
    asyncHandler(async (_req, res) => {
      requireDatabase();

      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .neq('id', 'NONE');
      if (deleteError) throw new ApiError(500, deleteError.message);

      const { data, error } = await supabase
        .from('properties')
        .insert(seedProperties.map(toDbRow))
        .select();
      if (error) throw new ApiError(500, error.message);

      return res.json((data || []).map(fromDbRow));
    }),
  );

  return router;
}

export default createPropertiesRouter;
