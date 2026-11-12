import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiBase } from '../api/client.js';
import { branding } from '../branding/theme.js';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Server settings — lets you point the app at any backend URL at runtime.
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiBase.get());
  const [testing, setTesting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null); // { ok, text }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const saveAndTest = async () => {
    setTesting(true);
    setServerMsg(null);
    const clean = serverUrl.trim().replace(/\/+$/, '');
    apiBase.set(clean);
    setServerUrl(clean);
    try {
      const res = await fetch(`${clean}/api/health`);
      const data = await res.json();
      if (data.status === 'ok') setServerMsg({ ok: true, text: `Connected ✓ (${data.env})` });
      else setServerMsg({ ok: false, text: 'Reached server but unexpected response.' });
    } catch {
      setServerMsg({ ok: false, text: 'Could not reach that URL. Check it and that the backend is awake.' });
    } finally {
      setTesting(false);
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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to dashboard'}
          </button>
          {error && <div className="err-text">{error}</div>}

          {/* Server settings */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <button type="button" className="dl-link" onClick={() => setShowServer((s) => !s)} style={{ textDecoration: 'none' }}>
              ⚙ Server settings {showServer ? '▲' : '▾'}
            </button>
            {showServer && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  Active: <b>{apiBase.get() || '(none)'}</b>{' '}
                  <span className="badge b-mut" style={{ marginLeft: 4 }}>
                    <span className="bd" />{apiBase.isOverride() ? 'manual override' : 'Vercel env var'}
                  </span>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Backend URL <span className="t-sub">override (e.g. from your phone)</span></label>
                  <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://your-backend.back4.app" autoComplete="off" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn ghost sm" onClick={saveAndTest} disabled={testing}>
                    {testing ? 'Testing…' : 'Save & test'}
                  </button>
                  <button type="button" className="btn ghost sm"
                    onClick={() => { apiBase.clear(); setServerUrl(apiBase.get()); setServerMsg({ ok: true, text: 'Override cleared — using the Vercel env var.' }); }}>
                    Use env var
                  </button>
                </div>
                {serverMsg && (
                  <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: serverMsg.ok ? 'var(--good)' : 'var(--bad)' }}>
                    {serverMsg.text}
                  </div>
                )}
                <div className="hint">The Vercel env var is the default. Only use this override when you can't update Vercel (e.g. on a phone).</div>
              </div>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
