import { useCallback, useEffect, useMemo, useState } from 'react';
import PropertyContext from './PropertyContext';
import propertyRepository, {
  PROPERTY_STORAGE_KEY,
} from '../services/propertyRepository';
import { getPropertyStats } from '../services/propertySelectors';

export default function PropertyProvider({ children }) {
  const [properties, setProperties] = useState(() => propertyRepository.getAll());

  const refresh = useCallback(() => {
    setProperties(propertyRepository.getAll());
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== PROPERTY_STORAGE_KEY && event.key !== null) return;
      refresh();
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refresh]);

  const createProperty = useCallback((values) => {
    const created = propertyRepository.create(values);
    setProperties(propertyRepository.getAll());
    return created;
  }, []);

  const updateProperty = useCallback((id, values) => {
    const updated = propertyRepository.update(id, values);
    setProperties(propertyRepository.getAll());
    return updated;
  }, []);

  const deleteProperty = useCallback((id) => {
    const removed = propertyRepository.remove(id);
    setProperties(propertyRepository.getAll());
    return removed;
  }, []);

  const resetProperties = useCallback(() => {
    const seeded = propertyRepository.reset();
    setProperties(seeded);
    return seeded;
  }, []);

  const getById = useCallback(
    (id) => {
      const normalizedId = String(id || '').trim().toUpperCase();
      return properties.find((property) => property.id === normalizedId) || null;
    },
    [properties],
  );

  const getBySlug = useCallback(
    (slug) => {
      const normalizedSlug = String(slug || '').trim().toLowerCase();
      return properties.find((property) => property.slug === normalizedSlug) || null;
    },
    [properties],
  );

  const stats = useMemo(() => getPropertyStats(properties), [properties]);

  const value = useMemo(
    () => ({
      properties,
      stats,
      createProperty,
      updateProperty,
      deleteProperty,
      resetProperties,
      refresh,
      getById,
      getBySlug,
    }),
    [
      properties,
      stats,
      createProperty,
      updateProperty,
      deleteProperty,
      resetProperties,
      refresh,
      getById,
      getBySlug,
    ],
  );

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}
