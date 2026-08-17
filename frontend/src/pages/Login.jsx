import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { DEMO_ACCOUNTS } from '../constants';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { phone, password } });
      login(data.token, data.user, data.refreshToken);
      navigate(homeFor(data.user.role), { replace: true });
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      <p className="muted">Phone number is your identity on AfriResQ.</p>
      <form onSubmit={submit}>
        <label className="field"><span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2567xxxxxxxx" required />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <Link className="btn ghost" to="/register">Create account</Link>
        </div>
      </form>
      {err && <div className="alert err">{err}</div>}
      <div className="demo">
        {DEMO_ACCOUNTS.map((a) => (
          <button key={a.phone} type="button" onClick={() => { setPhone(a.phone); setPassword(a.password); }}>
            <strong>{a.role}</strong> · {a.phone}
          </button>
        ))}
      </div>
    </div>
  );
}

function homeFor(role) {
  if (role === 'responder') return '/respond';
  if (role === 'coordinator' || role === 'admin') return '/dashboard';
  return '/report';
}
