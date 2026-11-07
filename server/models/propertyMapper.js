/**
 * Convert a frontend property object into the PostgreSQL / Supabase row format.
 */
export function toDbRow(property) {
  return {
    id: String(property.id || '').trim().toUpperCase(),
    slug: String(property.slug || '').trim().toLowerCase(),
    title: String(property.title || '').trim(),
    type: String(property.type || '').trim().toLowerCase(),
    purpose: String(property.purpose || '').trim().toLowerCase(),
    price: typeof property.price === 'number' ? property.price : Number(property.price),
    currency: String(property.currency || 'INR').trim().toUpperCase(),
    location: property.location || {},
    specifications: property.specifications || {},
    images: Array.isArray(property.images) ? property.images : [],
    description: String(property.description || '').trim(),
    amenities: Array.isArray(property.amenities) ? property.amenities : [],
    facilities: Array.isArray(property.facilities) ? property.facilities : [],
    status: String(property.status || 'available').trim().toLowerCase(),
    featured: Boolean(property.featured),
    trending: Boolean(property.trending),
    created_at: String(property.createdAt || new Date().toISOString().slice(0, 10)).trim(),
  };
}

/**
 * Convert a database row back into the frontend canonical property shape.
 */
export function fromDbRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    purpose: row.purpose,
    price: Number(row.price),
    currency: row.currency || 'INR',
    location: row.location || {},
    specifications: row.specifications || {},
    images: Array.isArray(row.images) ? row.images : [],
    description: row.description || '',
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    facilities: Array.isArray(row.facilities) ? row.facilities : [],
    status: row.status || 'available',
    featured: Boolean(row.featured),
    trending: Boolean(row.trending),
    createdAt: row.created_at || row.createdAt || '',
  };
}

