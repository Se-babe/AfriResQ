import { useCallback, useEffect, useState } from 'react';
import { api, wsUrl } from '../api';
import { useAuth } from '../auth.jsx';
import { SKILLS } from '../constants';
import { EmergencyCard } from '../components/EmergencyCard.jsx';
import { MapView } from '../components/MapView.jsx';
import { currentSubscription, disablePush, enablePush, pushPermission, pushSupported } from '../push';

export function ResponderConsole() {
  const { token, profile, setProfile } = useAuth();
  const [cases, setCases] = useState([]);
  const [notes, setNotes] = useState([]);
  const [availability, setAvailability] = useState(profile?.availability_status || 'offline');
  const [skills, setSkills] = useState(profile?.skills || []);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    currentSubscription().then((sub) => setPushOn(Boolean(sub)));
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    setErr('');
    try {
      if (pushOn) {
        await disablePush(token);
        setPushOn(false);
        setMsg('Push alerts turned off on this device.');
      } else {
        await enablePush(token);
        setPushOn(true);
        setMsg('Push alerts enabled — new cases will notify you even if AfriResQ is in the background.');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setAvailability(profile.availability_status);
      setSkills(profile.skills || []);
    }
  }, [profile]);

  const load = useCallback(async () => {
    try {
      const [mine, notesData] = await Promise.all([
        api('/emergencies/mine', { token }),
        api('/notifications', { token }),
      ]);
      setCases(mine);
      setNotes(notesData);
    } catch (e) {
      setErr(e.message);
    }
  }, [token]);

  useEffect(() => {
    load();
    let ws;
    try {
      ws = new WebSocket(wsUrl());
      ws.onmessage = () => load();
    } catch { /* polling fallback */ }
    const t = setInterval(load, 8000);
    return () => { clearInterval(t); ws?.close(); };
  }, [load]);

  const setLive = async (status) => {
    try {
      await api('/responders/me/availability', { method: 'PATCH', token, body: { status } });
      setAvailability(status);
      setProfile((p) => (p ? { ...p, availability_status: status } : p));
      setMsg(`You are ${status}.`);
    } catch (e) { setErr(e.message); }
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return setErr('Geolocation unavailable.');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api('/responders/me/location', { method: 'PATCH', token, body: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setMsg('Location shared with matching engine.');
      } catch (e) { setErr(e.message); }
    }, (e) => setErr(e.message));
  };

  const saveSkills = async () => {
    try {
      await api('/responders/me/skills', { method: 'PATCH', token, body: { skills } });
      setMsg('Skills updated.');
    } catch (e) { setErr(e.message); }
  };

  const pending = cases.filter((c) => c.match_status === 'notified' || c.match_status === 'proposed');
  const active = cases.filter((c) => ['accepted', 'in_progress'].includes(c.status));

  return (
    <div>
      {profile?.verification_status && profile.verification_status !== 'verified' && (
        <div className="alert warn">
          Your responder account is {profile.verification_status}. A coordinator must verify you before you can be matched to live emergencies.
        </div>
      )}
      <div className="split">
        <div className="stack">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Responder console</h2>
            <p className="muted">Set yourself available, share GPS, then accept cases that match your skills.</p>
            <div className="cluster">
              {['available', 'busy', 'offline'].map((s) => (
                <button key={s} className={`btn small ${availability === s ? 'teal' : 'ghost'}`} onClick={() => setLive(s)}>{s}</button>
              ))}
              <button className="btn ghost small" onClick={shareLocation}>Share location</button>
              {pushSupported() && pushPermission() !== 'denied' && (
                <button className="btn ghost small" onClick={togglePush} disabled={pushBusy}>
                  {pushBusy ? 'Working…' : pushOn ? 'Push alerts: on' : 'Enable push alerts'}
                </button>
              )}
            </div>
            {pushSupported() && pushPermission() === 'denied' && (
              <p className="tiny muted">Notifications are blocked for this site in your browser settings — enable them to get push alerts.</p>
            )}
            {msg && <div className="alert ok">{msg}</div>}
            {err && <div className="alert err">{err}</div>}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Incoming</h3>
            {pending.length === 0 && <p className="muted">No proposed cases right now.</p>}
            {pending.map((c) => (
              <EmergencyCard
                key={`${c.id}-${c.match_status}`}
                item={c}
                extra={`match ${c.match_status}`}
                actions={(
                  <>
                    <button className="btn primary small" onClick={() => api(`/emergencies/${c.id}/accept`, { method: 'POST', token }).then(load).catch((e) => setErr(e.message))}>Accept</button>
                    <button className="btn danger small" onClick={() => api(`/emergencies/${c.id}/decline`, { method: 'POST', token }).then(load).catch((e) => setErr(e.message))}>Decline</button>
                  </>
                )}
              />
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Active cases</h3>
            {active.length === 0 && <p className="muted">Nothing assigned to you.</p>}
            {active.map((c) => (
              <EmergencyCard
                key={c.id}
                item={c}
                actions={(
                  <>
                    {c.status === 'accepted' && <button className="btn teal small" onClick={() => api(`/emergencies/${c.id}/status`, { method: 'POST', token, body: { status: 'in_progress' } }).then(load).catch((e) => setErr(e.message))}>In progress</button>}
                    {c.status === 'in_progress' && <button className="btn teal small" onClick={() => api(`/emergencies/${c.id}/status`, { method: 'POST', token, body: { status: 'resolved' } }).then(load).catch((e) => setErr(e.message))}>Resolved</button>}
                  </>
                )}
              />
            ))}
          </div>
        </div>
        <div className="stack">
          <MapView emergencies={cases} responders={[]} />
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Skills</h3>
            <div className="cluster">
              {SKILLS.map((s) => (
                <button key={s} type="button" className={`btn small ${skills.includes(s) ? 'teal' : 'ghost'}`} onClick={() => setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}>
                  {s.replaceAll('_', ' ')}
                </button>
              ))}
            </div>
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={saveSkills}>Save skills</button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Alerts</h3>
            {notes.slice(0, 8).map((n) => (
              <div className="row" key={n.id}>
                <div>
                  <div>{n.message}</div>
                  <div className="tiny">{n.channel} · {n.status}</div>
                </div>
              </div>
            ))}
            {notes.length === 0 && <p className="muted">No notifications yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
