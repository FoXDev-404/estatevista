import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Container from '../../components/common/Container';
import PageMeta from '../../components/common/PageMeta';
import useAuth from '../../hooks/useAuth';

export default function AdminLogin() {
  const { isAdmin, isLoading, isSupabaseConfigured, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return <Navigate to="/admin/properties" replace />;
  }
  if (!isLoading && isAdmin) {
    return <Navigate to={location.state?.from?.pathname || '/admin/properties'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate(location.state?.from?.pathname || '/admin/properties', { replace: true });
    } catch (signInError) {
      setError(signInError.message || 'Sign-in failed. Check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Admin sign in" description="Sign in to manage EstateVista property records." noIndex />
      <Container className="admin-page admin-form-page">
        <div className="admin-page__header">
          <div>
            <p className="eyebrow">Property studio</p>
            <h1 className="admin-page__title">Sign in to continue</h1>
            <p className="admin-page__description">
              Administrator access is required to manage shared property records.
            </p>
          </div>
        </div>
        <form className="admin-panel admin-login-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button--primary button--md" type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </Container>
    </>
  );
}
