import { useCallback, useEffect, useMemo, useState } from 'react';
import PropertyContext from './PropertyContext';
import propertyApiService from '../services/propertyApiService';
import { getPropertyStats } from '../services/propertySelectors';
import { seedProperties } from '../data/properties';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export default function PropertyProvider({ children }) {
  // In tests, start with canonical seed; in browser, start with seed and immediately fetch live Supabase
  const [properties, setProperties] = useState(() => seedProperties);
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch directly from live Supabase database on mount
  useEffect(() => {
    if (isTestEnv) return;

    let ignore = false;

    async function load() {
      setIsSyncing(true);
      try {
        const liveProperties = await propertyApiService.getAll();
        if (!ignore && Array.isArray(liveProperties) && liveProperties.length > 0) {
          setProperties(liveProperties);
          setIsLiveBackend(true);
        }
      } catch (err) {
        console.warn('Could not fetch from Supabase, using defaults:', err?.message);
      } finally {
        if (!ignore) {
          setIsSyncing(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      const liveProperties = await propertyApiService.getAll();
      if (Array.isArray(liveProperties) && liveProperties.length > 0) {
        setProperties(liveProperties);
        setIsLiveBackend(true);
        return liveProperties;
      }
    } catch (err) {
      console.warn('Could not refresh from Supabase:', err?.message);
    } finally {
      setIsSyncing(false);
    }
    return properties;
  }, [properties]);

  const createProperty = useCallback(async (values) => {
    setIsSyncing(true);
    try {
      const created = await propertyApiService.create(values);
      setProperties((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      return created;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const updateProperty = useCallback(async (id, values) => {
    setIsSyncing(true);
    try {
      const updated = await propertyApiService.update(id, values);
      setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      return updated;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const deleteProperty = useCallback(async (id) => {
    setIsSyncing(true);
    try {
      const removed = await propertyApiService.remove(id);
      setProperties((prev) => prev.filter((p) => p.id !== id));
      return removed;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const resetProperties = useCallback(async () => {
    setIsSyncing(true);
    try {
      const liveSeeded = await propertyApiService.reset();
      if (Array.isArray(liveSeeded) && liveSeeded.length > 0) {
        setProperties(liveSeeded);
        return liveSeeded;
      }
    } finally {
      setIsSyncing(false);
    }
    setProperties(seedProperties);
    return seedProperties;
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
      isLiveBackend,
      isSyncing,
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
      isLiveBackend,
      isSyncing,
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
