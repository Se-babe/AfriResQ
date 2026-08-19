import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="ug-stripe" aria-hidden="true" />
        <div className="topbar-inner">
          <NavLink to={user ? homeFor(role) : '/'} className="brand">
          <div className="brand-mark" aria-hidden="true"><span>✚</span></div>
          <div>
            <h1>Afri<em>Res</em>Q</h1>
            <p className="brand-sub">Uganda</p>
          </div>
        </NavLink>
        <nav className="nav">
          {!user && (
            <>
              <NavLink to="/report">Report</NavLink>
              <NavLink to="/login">Sign in</NavLink>
            </>
          )}
          {role === 'citizen' && (
            <>
              <NavLink to="/report">Report</NavLink>
              <NavLink to="/reports">My reports</NavLink>
            </>
          )}
          {role === 'responder' && <NavLink to="/respond">My cases</NavLink>}
          {(role === 'coordinator' || role === 'admin') && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/responders">Responders</NavLink>
              <NavLink to="/organizations">Organizations</NavLink>
            </>
          )}
          {user && (
            <>
              <span className="who">{user.name.split(' ')[0]} · {role}</span>
              <button className="ghost" type="button" onClick={logout}>Sign out</button>
            </>
          )}
        </nav>
        </div>
      </header>
      <main className={`page ${location.pathname === '/dashboard' ? 'wide' : ''}`}>
        <Outlet />
      </main>
      <footer className="footer">
        AfriResQ is Uganda’s digital emergency coordination infrastructure. Free for citizens and organisations.
        It does not replace police, fire, ambulance, or hospital services.
      </footer>
    </div>
  );
}

function homeFor(role) {
  if (role === 'responder') return '/respond';
  if (role === 'coordinator' || role === 'admin') return '/dashboard';
  return '/report';
}
