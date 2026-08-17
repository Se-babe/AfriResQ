import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { SKILLS } from '../constants';

export function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const [skills, setSkills] = useState(['first_aid']);
  const [orgs, setOrgs] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/organizations').then(setOrgs).catch(() => {});
  }, []);

  const toggleSkill = (skill) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const body = { name, phone, password, role };
      if (role === 'responder') {
        body.skills = skills;
        if (organizationId) body.organizationId = organizationId;
      }
      const data = await api('/auth/register', { method: 'POST', body });
      login(data.token, data.user, data.refreshToken);
      navigate(role === 'responder' ? '/respond' : '/report', { replace: true });
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card auth-card">
      <h2 style={{ marginTop: 0 }}>Create an account</h2>
      <p className="muted">Citizens can also report without an account. Responders must register and wait for coordinator verification.</p>
      <form onSubmit={submit}>
        <label className="field"><span>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label className="field"><span>I am a</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="citizen">Community member</option>
            <option value="responder">Responder / volunteer</option>
          </select>
        </label>
        {role === 'responder' && (
          <>
            <div className="field">
              <span>Skills</span>
              <div className="cluster">
                {SKILLS.map((s) => (
                  <button type="button" key={s} className={`btn small ${skills.includes(s) ? 'teal' : 'ghost'}`} onClick={() => toggleSkill(s)}>
                    {s.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <label className="field"><span>Organization (optional)</span>
              <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                <option value="">Independent volunteer</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="field"><span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2567xxxxxxxx" required minLength={7} />
        </label>
        <label className="field"><span>Password (8+ characters)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <Link className="btn ghost" to="/login">I already have an account</Link>
        </div>
      </form>
      {err && <div className="alert err">{err}</div>}
    </div>
  );
}
