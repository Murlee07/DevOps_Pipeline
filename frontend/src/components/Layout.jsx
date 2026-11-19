import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { BoardIcon, GridIcon, LogoutIcon, MenuIcon, PipelineIcon, ShieldIcon } from './Icons.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/board', label: 'Task Board', icon: BoardIcon },
  { to: '/pipeline', label: 'Pipeline', icon: PipelineIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.info().then(setInfo).catch(() => setInfo(null));
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <ShieldIcon size={22} />
          </span>
          <div>
            <div className="brand-name">ShieldBoard</div>
            <div className="brand-sub">secure · ship · repeat</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="env-chip">
            <span className={`dot ${info?.database?.status === 'up' ? 'dot-ok' : 'dot-bad'}`} />
            <span className="mono">{info ? `${info.environment} · build #${info.buildNumber}` : 'API offline'}</span>
          </div>
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button className="icon-btn" onClick={logout} title="Sign out" aria-label="Sign out">
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <main className="main">
        <div className="topbar-mobile">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <span className="brand-name">ShieldBoard</span>
        </div>
        <Outlet context={{ info }} />
      </main>
    </div>
  );
}
