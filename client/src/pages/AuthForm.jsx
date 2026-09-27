import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthForm = ({ mode }) => {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    identifier: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      if (isLogin) {
        await login({ identifier: form.identifier, password: form.password });
      } else {
        await register({
          username: form.username,
          email: form.email,
          password: form.password,
          displayName: form.displayName || undefined,
        });
      }
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">
          {isLogin ? 'Sign in to continue chatting.' : 'Register to start messaging.'}
        </p>

        {error && <div className="form-error">{error}</div>}

        {isLogin ? (
          <>
            <label htmlFor="identifier">Username or email</label>
            <input
              id="identifier"
              value={form.identifier}
              onChange={update('identifier')}
              autoComplete="username"
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={form.username}
              onChange={update('username')}
              autoComplete="username"
              required
            />
            {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}

            <label htmlFor="displayName">Display name (optional)</label>
            <input id="displayName" value={form.displayName} onChange={update('displayName')} />

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={update('password')}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
        />
        {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : isLogin ? 'Log in' : 'Register'}
        </button>

        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : 'Already registered? '}
          <Link to={isLogin ? '/register' : '/login'}>
            {isLogin ? 'Register' : 'Log in'}
          </Link>
        </p>
      </form>
    </div>
  );
};

export default AuthForm;
