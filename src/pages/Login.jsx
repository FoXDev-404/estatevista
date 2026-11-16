import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Logo from '../components/common/Logo';
import PageMeta from '../components/common/PageMeta';
import { useAuth } from '../hooks/useAuth';

function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to={next} replace />;
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      await login(form);
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(error?.message || 'Sign-in failed. Try again.');
      setFieldErrors(error?.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <PageMeta title="Sign in" description="Sign in to the EstateVista company workspace." noIndex />

      <section className="auth-page__panel" aria-label="EstateVista workspace">
        <div className="auth-page__brand">
          <Logo />
        </div>

        <div className="auth-page__intro">
          <p className="auth-page__eyebrow">Company workspace</p>
          <h1 className="auth-page__title">
            Every project,
            <br />
            lead and agreement
            <br />
            in one calm place.
          </h1>
          <p className="auth-page__description">
            The operating desk for your sales, rental and collection teams — built around the way
            your company already works.
          </p>
        </div>

        <p className="auth-page__footnote">Private workspace · Authorised users only</p>
      </section>

      <section className="auth-page__form-panel">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <header className="auth-form__header">
            <p className="auth-form__eyebrow">Welcome back</p>
            <h2>Sign in</h2>
            <p>Use the account your workspace administrator created for you.</p>
          </header>

          {formError ? (
            <div className="auth-form__alert" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="form-field">
            <label className="form-field__label" htmlFor="login-email">
              Work email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={form.email}
              onChange={updateField('email')}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              required
            />
            {fieldErrors.email ? (
              <p className="form-field__error" id="login-email-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="login-password">
              Password
            </label>
            <div className="auth-form__password">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={form.password}
                onChange={updateField('password')}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                required
              />
              <button
                type="button"
                className="auth-form__reveal"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="form-field__error" id="login-password-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="button button--gold button--lg button--full"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
            {submitting ? null : <ArrowRight size={17} aria-hidden="true" />}
          </button>

          <p className="auth-form__hint">
            <LockKeyhole size={14} aria-hidden="true" />
            Sessions expire automatically after 8 hours of inactivity.
          </p>

          <Link className="auth-form__back" to="/">
            Back to the EstateVista website
          </Link>
        </form>
      </section>
    </div>
  );
}
