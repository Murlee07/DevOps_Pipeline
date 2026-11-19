import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { CheckIcon, ShieldIcon } from '../components/Icons.jsx';

const FEATURES = [
  'Code quality gated by SonarQube',
  'Dependencies & images scanned by Trivy',
  'Built and shipped by Jenkins + Docker',
  'Runs on Kubernetes, provisioned with Terraform',
];

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setErrors({ ...(err.details || {}), form: err.message });
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-hero-inner">
          <div className="brand big">
            <span className="brand-mark">
              <ShieldIcon size={28} />
            </span>
            <div className="brand-name">ShieldBoard</div>
          </div>
          <h1>
            Ship tasks.
            <br />
            <span className="grad">Not vulnerabilities.</span>
          </h1>
          <p className="lead">
            A secure task board delivered end-to-end through an automated DevSecOps pipeline.
          </p>
          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f}>
                <span className="tick">
                  <CheckIcon size={14} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <pre className="terminal" aria-hidden="true">
            <span className="t-dim">$</span> trivy image shieldboard-backend{'\n'}
            <span className="t-ok">✔ 0 CRITICAL</span> <span className="t-dim">· quality gate</span>{' '}
            <span className="t-ok">PASSED</span>
          </pre>
        </div>
        <div className="hero-glow" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted">{isLogin ? 'Sign in to your board.' : 'It takes less than a minute.'}</p>

          {!isLogin && (
            <label className="field">
              <span>Full name</span>
              <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Murali" />
              {errors.name && <small className="err">{errors.name}</small>}
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" />
            {errors.email && <small className="err">{errors.email}</small>}
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder={isLogin ? '••••••••' : 'Min 8 chars, letters + numbers'}
            />
            {errors.password && <small className="err">{errors.password}</small>}
          </label>

          {errors.form && !errors.name && !errors.email && !errors.password && <div className="alert">{errors.form}</div>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <p className="switch">
            {isLogin ? "Don't have an account? " : 'Already registered? '}
            <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create one' : 'Sign in'}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
