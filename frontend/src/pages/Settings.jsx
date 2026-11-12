import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Toast } from '../components/ui.jsx';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [org, setOrg] = useState(null);
  const [branding, setBranding] = useState({ displayName: '', logoUrl: '', primaryColor: '#0E7C86' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.get('/org').then((d) => {
      setOrg(d.organization);
      setBranding({
        displayName: d.organization.branding?.displayName || '',
        logoUrl: d.organization.branding?.logoUrl || '',
        primaryColor: d.organization.branding?.primaryColor || '#0E7C86',
      });
    }).catch(() => {});
  }, []);

  const notify = (message, bad) => { setToast({ message, bad }); setTimeout(() => setToast(null), 3000); };

  const saveBranding = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { organization } = await api.patch('/org', { branding });
      setOrg(organization);
      // Live-apply the accent so the change is visible immediately.
      document.documentElement.style.setProperty('--teal', branding.primaryColor);
      notify('Branding saved.');
    } catch (err) { notify(err.message, true); }
    finally { setSaving(false); }
  };

  if (!org) return null;

  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><div className="desc">White-label branding for your hospital portal.</div></div>
        {!isAdmin && <span className="badge b-mut"><span className="bd" />Read-only · admin to edit</span>}
      </div>

      <form className="card" style={{ padding: 20, maxWidth: 560 }} onSubmit={saveBranding}>
        <h3 style={{ fontSize: 14.5, marginBottom: 14 }}>White-label branding</h3>

        <div className="field">
          <label>Hospital display name</label>
          <input value={branding.displayName} disabled={!isAdmin}
            onChange={(e) => setBranding({ ...branding, displayName: e.target.value })}
            placeholder="NCRIMS Care Connect" />
        </div>

        <div className="field">
          <label>Primary colour</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="color" value={branding.primaryColor} disabled={!isAdmin}
              onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              style={{ width: 44, height: 40, padding: 2, cursor: isAdmin ? 'pointer' : 'default' }} />
            <input style={{ flex: 1 }} value={branding.primaryColor} disabled={!isAdmin}
              onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              placeholder="#0E7C86" />
          </div>
          <div className="hint">Drives the logo, login screen, and accent across the portal.</div>
        </div>

        <div className="field">
          <label>Logo URL <span className="t-sub">optional</span></label>
          <input value={branding.logoUrl} disabled={!isAdmin}
            onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
            placeholder="https://…/logo.png" />
        </div>

        {isAdmin && <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</button>}
      </form>

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </>
  );
}
