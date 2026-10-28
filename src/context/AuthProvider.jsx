import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthContext from './AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

  const checkAdmin = useCallback(async (user) => {
    if (!user || !supabase) {
      setIsAdmin(false);
      return false;
    }

    const { data, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      setError(adminError);
      setIsAdmin(false);
      return false;
    }

    const authorized = Boolean(data);
    setIsAdmin(authorized);
    return authorized;
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError);
      setSession(data.session);
      await checkAdmin(data.session?.user);
      if (active) setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      await checkAdmin(nextSession?.user);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase authentication is not configured.');
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error);
      throw result.error;
    }
    return result.data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isAdmin,
      isLoading,
      error,
      isSupabaseConfigured,
      signIn,
      signOut,
    }),
    [session, isAdmin, isLoading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
