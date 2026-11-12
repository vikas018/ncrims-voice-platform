import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { branding } from '../branding/theme.js';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('priya.sharma@ncrims.in');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      // AuthProvider sets user -> App redirects to "/"
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <div className="mark">
          <span className="logo">{branding.logoText}</span> {branding.shortName}{' '}
          <small style={{ color: '#9FC2C4', fontWeight: 500 }}>{branding.productName}</small>
        </div>
        <div>
          <h2>{branding.org.tagline}</h2>
          <p>{branding.org.blurb}</p>
        </div>
        <div style={{ fontSize: 12, color: '#8FB0B2' }}>{branding.org.legalName} · Staff Portal</div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h3>Sign in</h3>
          <div className="sub">Welcome back. Please enter your details.</div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to dashboard'}
          </button>
          {error && <div className="err-text">{error}</div>}
          <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
            Seeded demo login is pre-filled. Run <code>npm run seed</code> on the backend first.
          </p>
        </form>
      </div>
    </div>
  );
}
