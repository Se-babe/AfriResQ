import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, wsUrl } from '../api';
import { useAuth } from '../auth.jsx';
import { categoryLabel, formatWhen } from '../constants';
import { MapView } from '../components/MapView.jsx';
import { SeverityBadge, StatusPill } from '../components/SeverityBadge.jsx';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer.jsx';
import { RatingForm } from '../components/RatingForm.jsx';

export function EmergencyDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const loadRef = useRef();

  const load = async () => {
    try {
      setData(await api(`/emergencies/${id}`, { token }));
    } catch (e) {
      setErr(e.message);
    }
  };
  loadRef.current = load;

  useEffect(() => { load(); }, [id, token]);

  // Live updates: responder location changes and status changes on this
  // case both broadcast over the same WS the dashboard uses. Any message ->
  // just refetch this case, same "dumb refresh" pattern as Dashboard.jsx.
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(wsUrl());
      ws.onmessage = () => loadRef.current();
    } catch { /* live tracking is a nice-to-have; polling fallback below covers it */ }
    const t = setInterval(() => loadRef.current(), 15000);
    return () => { clearInterval(t); ws?.close(); };
  }, [id]);

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
          {data.assignedResponder?.distance_km != null && (
            <p className="tiny" style={{ marginTop: 10 }}>
              🚑 {data.assignedResponder.name} is <strong>{data.assignedResponder.distance_km} km</strong> away · ~
              <strong>{data.assignedResponder.eta_minutes} min</strong>
              {data.assignedResponder.last_location_at ? ` · updated ${formatWhen(data.assignedResponder.last_location_at)}` : ''}
            </p>
          )}
          {e.hasVoiceNote && <VoiceNotePlayer emergencyId={id} token={token} />}
        </div>
        <MapView
          emergencies={[e]}
          responders={data.assignedResponder?.current_lat != null ? [data.assignedResponder] : []}
          center={{ lat: e.lat, lng: e.lng }}
        />
        {role === 'citizen' && e.reporter_id === user?.id && ['resolved', 'closed'].includes(e.status) && (
          <RatingForm
            emergencyId={id}
            token={token}
            existingRating={data.rating}
            onRated={(rating) => setData((d) => ({ ...d, rating }))}
          />
        )}
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
