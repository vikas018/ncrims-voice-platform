import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Icon } from './ui.jsx';
import { initials, fmtDateTime } from '../utils/format.js';
import { branding } from '../branding/theme.js';

/** Read-only account details + a change-password form for the signed-in user. */
export default function ProfileModal({ user, onClose }) {
  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState(null); // { text, bad }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (pwd.newPassword !== pwd.confirm) {
      setMsg({ text: 'New password and confirmation do not match', bad: true });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      });
      setMsg({ text: 'Password updated successfully.', bad: false });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      setShowPwd(false);
    } catch (err) {
      setMsg({ text: err.message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h3 style={{ fontSize: 17 }}>My Profile</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div className="avatar" style={{ width: 54, height: 54, fontSize: 18 }}>{initials(user?.name)}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 650 }}>{user?.name}</div>
              <div className="t-sub">{user?.email}</div>
            </div>
          </div>
          <div className="modal-meta">
            <div className="mm"><div className="k">Role</div>
              <div className="v"><Badge tone={user?.role === 'admin' ? 'b-info' : 'b-mut'}>{user?.role?.[0]?.toUpperCase() + user?.role?.slice(1)}</Badge></div></div>
            <div className="mm"><div className="k">Status</div>
              <div className="v"><Badge tone={user?.isActive ? 'b-good' : 'b-mut'}>{user?.isActive ? 'Active' : 'Inactive'}</Badge></div></div>
            <div className="mm"><div className="k">Organization</div><div className="v">{branding.org.legalName}</div></div>
            <div className="mm"><div className="k">Last active</div><div className="v num">{fmtDateTime(user?.lastActiveAt)}</div></div>
          </div>

          {/* Change password */}
          {!showPwd ? (
            <button className="btn ghost sm" onClick={() => { setShowPwd(true); setMsg(null); }}>
              <Icon.User />Change password
            </button>
          ) : (
            <form onSubmit={submit} style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 650, marginBottom: 12 }}>Change password</div>
              <div className="field">
                <label>Current password</label>
                <input type="password" autoComplete="current-password" value={pwd.currentPassword}
                  onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} required />
              </div>
              <div className="field">
                <label>New password <span className="t-sub">(min 6 characters)</span></label>
                <input type="password" autoComplete="new-password" value={pwd.newPassword}
                  onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} minLength={6} required />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input type="password" autoComplete="new-password" value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} minLength={6} required />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
                <button type="button" className="btn ghost" onClick={() => { setShowPwd(false); setMsg(null); }}>Cancel</button>
              </div>
            </form>
          )}

          {msg && (
            <div className={msg.bad ? 'err-text' : ''} style={{ marginTop: 12, color: msg.bad ? 'var(--bad)' : 'var(--good)', fontSize: 12.5, fontWeight: 600 }}>
              {msg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
