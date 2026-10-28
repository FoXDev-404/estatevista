import { useCallback, useEffect, useMemo, useState } from 'react';
import PropertyContext from './PropertyContext';
import propertyRepository, {
  PROPERTY_STORAGE_KEY,
} from '../services/propertyRepository';
import { getPropertyStats } from '../services/propertySelectors';
import useAuth from '../hooks/useAuth';
import { isSupabaseConfigured } from '../services/supabaseClient';

export default function PropertyProvider({ children }) {
  const { isAdmin, isLoading: isAuthLoading } = useAuth();
  const [properties, setProperties] = useState(() =>
    isSupabaseConfigured ? [] : propertyRepository.getAll(),
  );
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isAuthLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await propertyRepository.getAllAsync({ admin: isAdmin });
      setProperties(loaded);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, isAuthLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== PROPERTY_STORAGE_KEY && event.key !== null) return;
      refresh();
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refresh]);

  const createProperty = useCallback(async (values) => {
    const created = await propertyRepository.createAsync(values);
    await refresh();
    return created;
  }, [refresh]);

  const updateProperty = useCallback(async (id, values) => {
    const updated = await propertyRepository.updateAsync(id, values);
    await refresh();
    return updated;
  }, [refresh]);

  const deleteProperty = useCallback(async (id) => {
    const removed = await propertyRepository.removeAsync(id);
    await refresh();
    return removed;
  }, [refresh]);

  const resetProperties = useCallback(async () => {
    const seeded = await propertyRepository.resetAsync();
    await refresh();
    return seeded;
  }, [refresh]);

  const importProperties = useCallback(async (records, options) => {
    const result = await propertyRepository.importPropertiesAsync(records, options);
    await refresh();
    return result;
  }, [refresh]);

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
      isLoading,
      error,
      stats,
      createProperty,
      updateProperty,
      deleteProperty,
      resetProperties,
      importProperties,
      refresh,
      getById,
      getBySlug,
    }),
    [
      properties,
      isLoading,
      error,
      stats,
      createProperty,
      updateProperty,
      deleteProperty,
      resetProperties,
      importProperties,
      refresh,
      getById,
      getBySlug,
    ],
  );

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}
