import { useCallback, useEffect, useMemo, useState } from 'react';
import PropertyContext from './PropertyContext';
import propertyRepository, {
  PROPERTY_STORAGE_KEY,
} from '../services/propertyRepository';
import propertyApiService from '../services/propertyApiService';
import { getPropertyStats } from '../services/propertySelectors';

export default function PropertyProvider({ children }) {
  const [properties, setProperties] = useState(() => propertyRepository.getAll());
  const [isLiveBackend, setIsLiveBackend] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with live backend API on mount
  useEffect(() => {
    // Skip remote fetch in headless testing environment
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return;
    }

    let isMounted = true;

    async function syncWithApi() {
      setIsSyncing(true);
      try {
        const liveProperties = await propertyApiService.getAll();
        if (isMounted && Array.isArray(liveProperties) && liveProperties.length > 0) {
          setProperties(liveProperties);
          setIsLiveBackend(true);
        }
      } catch (err) {
        console.debug('Using local repository cache:', err?.message);
      } finally {
        if (isMounted) setIsSyncing(false);
      }
    }

    syncWithApi();

    return () => {
      isMounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      const live = await propertyApiService.getAll();
      if (Array.isArray(live) && live.length > 0) {
        setProperties(live);
        return live;
      }
    } catch {
      // Fallback to local
    } finally {
      setIsSyncing(false);
    }
    const local = propertyRepository.getAll();
    setProperties(local);
    return local;
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== PROPERTY_STORAGE_KEY && event.key !== null) return;
      setProperties(propertyRepository.getAll());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const createProperty = useCallback((values) => {
    // 1. Optimistic / local create
    const created = propertyRepository.create(values);
    setProperties(propertyRepository.getAll());

    // 2. Sync to Node / Supabase backend asynchronously
    propertyApiService.create(created).catch((err) => {
      console.warn('Failed to sync created property to backend:', err?.message);
    });

    return created;
  }, []);

  const updateProperty = useCallback((id, values) => {
    // 1. Optimistic / local update
    const updated = propertyRepository.update(id, values);
    setProperties(propertyRepository.getAll());

    // 2. Sync to Node / Supabase backend asynchronously
    propertyApiService.update(id, updated).catch((err) => {
      console.warn('Failed to sync updated property to backend:', err?.message);
    });

    return updated;
  }, []);

  const deleteProperty = useCallback((id) => {
    // 1. Optimistic / local delete
    const removed = propertyRepository.remove(id);
    setProperties(propertyRepository.getAll());

    // 2. Sync to Node / Supabase backend asynchronously
    propertyApiService.remove(id).catch((err) => {
      console.warn('Failed to sync property deletion to backend:', err?.message);
    });

    return removed;
  }, []);

  const resetProperties = useCallback(async () => {
    setIsSyncing(true);
    const seeded = propertyRepository.reset();
    setProperties(seeded);

    try {
      const liveSeeded = await propertyApiService.reset();
      if (Array.isArray(liveSeeded) && liveSeeded.length > 0) {
        setProperties(liveSeeded);
      }
    } catch (err) {
      console.warn('Backend reset failed, reverted to local seeds:', err?.message);
    } finally {
      setIsSyncing(false);
    }

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
