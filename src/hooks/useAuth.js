import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export default function useAuth() {
  const context = useContext(AuthContext);
  return context || {
    session: null,
    user: null,
    isAdmin: false,
    isLoading: false,
    error: null,
    isSupabaseConfigured: false,
    signIn: async () => {
      throw new Error('Supabase authentication is not configured.');
    },
    signOut: async () => {},
  };
}
