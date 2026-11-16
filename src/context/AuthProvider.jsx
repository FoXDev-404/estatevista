import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext';
import authApiService from '../services/authApiService';

const ANONYMOUS = Object.freeze({
  user: null,
  company: null,
  permissions: [],
  roles: [],
  expiresAt: null,
});

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(ANONYMOUS);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const data = await authApiService.me();
        if (ignore) return;

        if (data?.user) {
          setSession(data);
          setStatus('authenticated');
        } else {
          setSession(ANONYMOUS);
          setStatus('anonymous');
        }
      } catch {
        if (ignore) return;
        setSession(ANONYMOUS);
        setStatus('anonymous');
      }
    }

    bootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authApiService.login(credentials);
    setSession(data);
    setStatus('authenticated');
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApiService.logout();
    } catch (error) {
      if (error?.status !== 401) throw error;
    }
    setSession(ANONYMOUS);
    setStatus('anonymous');
  }, []);

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      if (session.user?.full_access) return true;
      const permissions = session.permissions || [];
      return permissions.includes('*') || permissions.includes(permission);
    },
    [session],
  );

  const value = useMemo(
    () => ({
      ...session,
      status,
      isAuthenticated: status === 'authenticated',
      hasPermission,
      login,
      logout,
    }),
    [session, status, hasPermission, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
