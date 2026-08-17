import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { categoryLabel, formatWhen } from '../constants';
import { MapView } from '../components/MapView.jsx';
import { SeverityBadge, StatusPill } from '../components/SeverityBadge.jsx';

export function EmergencyDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await api(`/emergencies/${id}`, { token }));
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { load(); }, [id, token]);

  if (err && !data) return <div className="alert err">{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const e = data.emergency;
  const role = user?.role;
  const match = (data.matches || []).find((m) => m.responder_id === user?.id);
  const canAccept = role === 'responder' && match && ['proposed', 'notified'].includes(match.status) && !e.assigned_responder_id;
  const canAdvance = (role === 'responder' && e.assigned_responder_id === user?.id) || role === 'coordinator' || role === 'admin';

  const act = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); await load(); }
    catch (error) { setErr(error.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="split">
      <div className="stack">
        <div className="card">
          <div className="cluster">
            <SeverityBadge severity={e.severity} />
            <StatusPill status={e.status} />
            <span className="tiny">Priority {e.priority_score}</span>
          </div>
          <h2 style={{ margin: '10px 0 6px' }}>{categoryLabel(e.category)}</h2>
          <p>{e.description || 'No description provided.'}</p>
          <p className="tiny">
            {e.address_text || `${e.lat}, ${e.lng}`} · {formatWhen(e.created_at)}
            {e.assigned_responder_name ? ` · Assigned to ${e.assigned_responder_name}` : ''}
          </p>
          {err && <div className="alert err">{err}</div>}
          <div className="cluster" style={{ marginTop: 12 }}>
            {canAccept && (
              <>
                <button className="btn primary" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/accept`, { method: 'POST', token }))}>Accept case</button>
                <button className="btn danger" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/decline`, { method: 'POST', token }))}>Decline</button>
              </>
            )}
            {canAdvance && e.status === 'accepted' && (
              <button className="btn teal" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/status`, { method: 'POST', token, body: { status: 'in_progress', note } }))}>Mark in progress</button>
            )}
            {canAdvance && e.status === 'in_progress' && (
              <button className="btn teal" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/status`, { method: 'POST', token, body: { status: 'resolved', note } }))}>Mark resolved</button>
            )}
            {canAdvance && e.status === 'resolved' && (role === 'coordinator' || role === 'admin') && (
              <button className="btn ghost" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/status`, { method: 'POST', token, body: { status: 'closed', note } }))}>Close</button>
            )}
            {(role === 'coordinator' || role === 'admin') && !e.assigned_responder_id && !['resolved', 'closed', 'cancelled'].includes(e.status) && (
              <button className="btn ink" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/rematch`, { method: 'POST', token }))}>Rematch responders</button>
            )}
            {(role === 'coordinator' || role === 'admin') && !['resolved', 'closed', 'cancelled'].includes(e.status) && (
              <button className="btn danger" disabled={busy} onClick={() => act(() => api(`/emergencies/${id}/status`, { method: 'POST', token, body: { status: 'cancelled', note } }))}>Cancel</button>
            )}
            <button className="btn ghost" type="button" onClick={() => navigate(-1)}>Back</button>
          </div>
          {canAdvance && (
            <label className="field"><span>Note (optional)</span>
              <input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Arrival notes, handover, outcome…" />
            </label>
          )}
        </div>
        <MapView emergencies={[e]} responders={[]} center={{ lat: e.lat, lng: e.lng }} />
      </div>
      <div className="stack">
        {data.matches && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Matched responders</h3>
            {data.matches.length === 0 && <p className="muted">No candidates yet.</p>}
            {data.matches.map((m) => (
              <div className="row" key={m.id}>
                <div>
                  <strong>{m.name}</strong>
                  <div className="tiny">{m.phone} · {m.distance_km} km · score {m.total_score}</div>
                </div>
                <span className="pill">{m.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Audit trail</h3>
          <ul className="timeline">
            {(data.events || []).map((ev) => (
              <li key={ev.id}>
                <strong>{ev.event_type.replaceAll('_', ' ')}</strong>
                <div className="tiny">{formatWhen(ev.created_at)}</div>
                {ev.details && <pre className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{pretty(ev.details)}</pre>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function pretty(details) {
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(details);
  }
}
