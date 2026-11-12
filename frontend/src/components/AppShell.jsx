import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { branding } from '../branding/theme.js';
import { Icon } from './ui.jsx';
import ProfileModal from './ProfileModal.jsx';
import { fmtInt, initials } from '../utils/format.js';

const TITLES = {
  '/': 'Dashboard', '/campaigns': 'Campaigns', '/calls': 'Call Logs',
  '/billing': 'Billing & Minutes', '/users': 'Users & Roles', '/settings': 'Settings',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [balance, setBalance] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef(null);

  // Keep the top-bar minute chip fresh whenever the route changes.
  useEffect(() => {
    api.get('/wallet').then(setBalance).catch(() => {});
  }, [location.pathname]);

  // Close the profile menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ncrims_theme', next); // persist the choice across reloads
    setTheme(next);
  };

  const navClass = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <span className="logo">{branding.logoText}</span>
          <div>{branding.shortName}<small>{branding.productName}</small></div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={navClass}><Icon.Dashboard />Dashboard</NavLink>
          <NavLink to="/campaigns" className={navClass}><Icon.Campaign />Campaigns</NavLink>
          <NavLink to="/calls" className={navClass}><Icon.Phone className="ic" />Call Logs</NavLink>
          <NavLink to="/billing" className={navClass}><Icon.Billing />Billing &amp; Minutes</NavLink>
          <div className="nav-sect">Administration</div>
          <NavLink to="/users" className={navClass}><Icon.Users />Users &amp; Roles</NavLink>
          <NavLink to="/settings" className={navClass}><Icon.Settings />Settings</NavLink>
        </nav>
        <div className="sb-foot">
          <div className="avatar">{initials(user?.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
            <small style={{ textTransform: 'capitalize' }}>{user?.role}</small>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="page-title">{TITLES[location.pathname] || ''}</div>
          <div className="spacer" />
          <NavLink to="/billing" className="mbchip" title="View billing details">
            <span className="dot" />
            <div>
              <b className="num">{balance ? fmtInt(balance.remainingMinutes) : '—'}</b>{' '}
              <span>/ {balance ? fmtInt(balance.totalMinutes) : '—'} min</span>
            </div>
          </NavLink>
          <button className="iconbtn" onClick={toggleTheme} title="Toggle light/dark" aria-label="Toggle theme">
            <Icon.Moon />
          </button>

          <div className="profile-wrap" ref={menuRef}>
            <button className="profile-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
              <span className="avatar">{initials(user?.name)}</span>
              <Icon.Caret className="caret" />
            </button>
            {menuOpen && (
              <div className="menu">
                <div className="menu-head">
                  <div className="nm">{user?.name}</div>
                  <div className="em">{user?.email}</div>
                </div>
                <button className="menu-item" onClick={() => { setShowProfile(true); setMenuOpen(false); }}>
                  <Icon.User />My Profile
                </button>
                <button className="menu-item danger" onClick={logout}>
                  <Icon.Logout />Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="content">
          <Outlet context={{ refreshBalance: () => api.get('/wallet').then(setBalance).catch(() => {}) }} />
        </div>
      </div>

      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
