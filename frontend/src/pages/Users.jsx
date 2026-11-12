import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Icon, Toast } from '../components/ui.jsx';
import { initials, fmtDateTime } from '../utils/format.js';

export default function Users() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => api.get('/auth/users').then((d) => setUsers(d.users)).catch(() => {});
  useEffect(() => { load(); }, []);

  const notify = (message, bad) => { setToast({ message, bad }); setTimeout(() => setToast(null), 3200); };

  const invite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', form);
      notify(`Invited ${form.name}.`);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      setShowForm(false);
      load();
    } catch (err) { notify(err.message, true); }
  };

  const changeRole = async (u, role) => {
    if (role === u.role) return;
    setBusyId(u.id);
    try { await api.patch(`/auth/users/${u.id}`, { role }); notify(`${u.name} is now ${role}.`); await load(); }
    catch (err) { notify(err.message, true); }
    finally { setBusyId(null); }
  };

  const toggleActive = async (u) => {
    setBusyId(u.id);
    try {
      await api.patch(`/auth/users/${u.id}`, { isActive: !u.isActive });
      notify(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (err) { notify(err.message, true); }
    finally { setBusyId(null); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setBusyId(u.id);
    try { await api.del(`/auth/users/${u.id}`); notify(`${u.name} deleted.`); await load(); }
    catch (err) { notify(err.message, true); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Users &amp; Roles</h1><div className="desc">Manage who can run campaigns and who controls the wallet.</div></div>
        {isAdmin && <button className="btn" onClick={() => setShowForm((s) => !s)}><Icon.Plus />Invite staff</button>}
      </div>

      {showForm && isAdmin && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <form onSubmit={invite} className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
            <div className="field" style={{ margin: 0 }}><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field" style={{ margin: 0 }}><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="field" style={{ margin: 0 }}><label>Temp password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option><option value="admin">Admin</option>
              </select>
              <button className="btn">Invite</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last active</th><th>Status</th>{isAdmin && <th>Actions</th>}</tr></thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} style={{ opacity: busyId === u.id ? 0.5 : 1 }}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="avatar" style={{ width: 30, height: 30 }}>{initials(u.name)}</span>
                      <span className="t-name">{u.name}{isSelf && <span className="t-sub"> (You)</span>}</span></div></td>
                    <td className="t-sub">{u.email}</td>
                    <td>
                      {isAdmin && !isSelf ? (
                        <select className="select" style={{ padding: '4px 8px', fontSize: 12 }} value={u.role}
                          disabled={busyId === u.id} onChange={(e) => changeRole(u, e.target.value)}>
                          <option value="staff">Staff</option><option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge tone={u.role === 'admin' ? 'b-info' : 'b-mut'}>{u.role[0].toUpperCase() + u.role.slice(1)}</Badge>
                      )}
                    </td>
                    <td className="t-sub">{u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : '—'}</td>
                    <td><Badge tone={u.isActive ? 'b-good' : 'b-mut'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    {isAdmin && (
                      <td>
                        {isSelf ? (
                          <span className="t-sub">—</span>
                        ) : (
                          <div className="pill-row">
                            <button className="btn ghost sm" disabled={busyId === u.id} onClick={() => toggleActive(u)}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn ghost sm" disabled={busyId === u.id} onClick={() => remove(u)}
                              style={{ color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 40%, transparent)' }}>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </>
  );
}
