import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { MapView } from '../components/MapView.jsx';

export function Responders() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    try {
      const [all, wait] = await Promise.all([
        api('/responders', { token }),
        api('/responders/pending', { token }),
      ]);
      setRows(all);
      setPending(wait);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, [token]);

  const verify = async (userId, status) => {
    try {
      await api(`/responders/${userId}/verify`, { method: 'POST', token, body: { status, notes } });
      setNotes('');
      load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="split">
      <div className="stack">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Verification queue</h2>
          {err && <div className="alert err">{err}</div>}
          {pending.length === 0 && <p className="muted">No responders waiting.</p>}
          <label className="field"><span>Verification notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note attached to verify/reject" />
          </label>
          {pending.map((p) => (
            <div className="row" key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <div className="tiny">{p.phone} · {p.organization_name || 'Independent'} · {(p.skills || []).join(', ')}</div>
              </div>
              <div className="cluster">
                <button className="btn primary small" onClick={() => verify(p.id, 'verified')}>Verify</button>
                <button className="btn danger small" onClick={() => verify(p.id, 'rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>All responders</h3>
          {rows.map((r) => (
            <div className="row" key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <div className="tiny">{r.phone} · {r.organization_name || 'Independent'} · {(r.skills || []).join(', ')}</div>
              </div>
              <div className="stack" style={{ textAlign: 'right' }}>
                <span className="pill">{r.verification_status}</span>
                <span className="tiny">{r.availability_status} · {r.active_case_count} active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MapView responders={rows.filter((r) => r.current_lat != null)} emergencies={[]} tall />
    </div>
  );
}
